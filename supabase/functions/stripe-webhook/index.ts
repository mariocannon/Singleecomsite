// supabase/functions/stripe-webhook/index.ts
//
// One function URL, two Stripe webhook *destinations* pointed at it — set
// this up as two separate entries in the Stripe Dashboard (Developers ->
// Webhooks -> + Add destination), each with its own signing secret:
//
//   .../stripe-webhook?type=checkout   Standard event: checkout.session.completed
//                                       -> marks the order paid, bumps quantity_sold,
//                                          sends the buyer a Stripe receipt email
//                                          from the seller's connected account
//
//   .../stripe-webhook?type=account    Thin (v2) events on Connected accounts,
//                                       e.g. v2.core.account[requirements].updated
//                                       -> currently just logged (see TODO below)
//
// Because checkout uses Direct Charges, checkout.session.completed fires on
// the *connected* account — the checkout destination must be registered as a
// Connect webhook ("Listen to events on connected accounts"), not an account
// webhook, or the events never arrive.
//
// PLACEHOLDER: after deploying, grab this function's URL from the Supabase
// dashboard and register both destinations, then set STRIPE_WEBHOOK_SECRET
// and STRIPE_WEBHOOK_SECRET_THIN to the two signing secrets Stripe gives you.

import Stripe from "https://esm.sh/stripe@18?target=deno";
import { createClient } from "npm:@supabase/supabase-js@2";

// verify_jwt is disabled for this function (Stripe can't send a Supabase
// JWT) — signature verification below is what actually authenticates
// incoming requests instead.

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "checkout";
  const signature = req.headers.get("Stripe-Signature");
  const body = await req.text();

  if (!signature) {
    return new Response("Missing Stripe-Signature header", { status: 400 });
  }
  if (!STRIPE_SECRET_KEY) {
    console.error("Missing STRIPE_SECRET_KEY env var.");
    return new Response("Server misconfigured", { status: 500 });
  }

  if (type === "account") {
    return handleThinEvent(body, signature);
  }
  return handleCheckoutEvent(body, signature);
});

async function handleCheckoutEvent(body: string, signature: string) {
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET env var.");
    return new Response("Server misconfigured", { status: 500 });
  }

  let event;
  try {
    // constructEventAsync (not the sync constructEvent) is required in Deno,
    // where crypto operations are async.
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, undefined, cryptoProvider);
  } catch (err) {
    console.error("Checkout webhook signature verification failed:", err instanceof Error ? err.message : err);
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const storeId = session.metadata?.store_id;

    if (!storeId) {
      console.error("checkout.session.completed with no store_id metadata:", session.id);
      return new Response("ok", { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // orders.stripe_checkout_session_id has a unique constraint, so a
    // retried webhook delivery won't create a duplicate order row.
    const { error: orderError } = await supabase.from("orders").insert({
      store_id: storeId,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: session.payment_intent,
      buyer_email: session.customer_details?.email ?? null,
      amount_cents: session.amount_total,
      // orders.status check constraint only allows pending/completed/refunded
      status: "completed",
    });

    if (orderError) {
      // 23505 = unique_violation -> this session was already processed, not a real error.
      if (orderError.code !== "23505") {
        console.error("Failed to insert order:", orderError);
      }
    } else {
      const { error: rpcError } = await supabase.rpc("increment_quantity_sold", {
        p_store_id: storeId,
      });
      if (rpcError) console.error("Failed to increment quantity_sold:", rpcError);

      // Setting receipt_email on an already-succeeded PaymentIntent makes
      // Stripe send its receipt email, regardless of the seller's dashboard
      // email settings. The PaymentIntent lives on the connected account
      // (direct charge), so the receipt carries the seller's branding and
      // business name. Runs only on first delivery (inside the non-duplicate
      // branch) so retried webhooks don't re-send the receipt. Stripe only
      // sends receipt emails in live mode.
      const buyerEmail = session.customer_details?.email;
      const connectedAccount = event.account;
      if (buyerEmail && session.payment_intent && connectedAccount) {
        try {
          await stripe.paymentIntents.update(
            session.payment_intent,
            { receipt_email: buyerEmail },
            { stripeAccount: connectedAccount }
          );
        } catch (err) {
          console.error(
            "Failed to set receipt_email on PaymentIntent:",
            err instanceof Error ? err.message : err
          );
        }
      }
    }
  }

  return new Response("ok", { status: 200 });
}

async function handleThinEvent(body: string, signature: string) {
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET_THIN");
  if (!webhookSecret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET_THIN env var.");
    return new Response("Server misconfigured", { status: 500 });
  }

  let thinEvent;
  try {
    thinEvent = await stripe.parseThinEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Thin event signature verification failed:", err instanceof Error ? err.message : err);
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  // Thin events carry only an id + type. We'd normally fetch the full event
  // via stripe.v2.core.events.retrieve() for details, but that call requires
  // a separate "Events v2" access grant beyond basic platform setup —
  // skipping it for now since nothing acts on the details yet anyway.
  console.log("Connected account event:", thinEvent.type, thinEvent.id);

  // TODO: when requirements go currently_due/past_due, consider fetching the
  // full event (once Events v2 access is confirmed) and flagging the
  // relevant store so the seller sees a "reverify with Stripe" prompt next
  // time they open their manage dashboard — no DB write wired up yet.

  return new Response("ok", { status: 200 });
}
