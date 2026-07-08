/*
  This is a "no backend yet" mockup. Everything lives in localStorage
  in place of Supabase, so you can click through the real flow —
  create a store, publish it, "buy" from it — without any server.
  Nothing here leaves your browser.
*/

const STORAGE_PREFIX = 'peg_store_';
const LIST_KEY = 'peg_store_list';

function slugify(str) {
  return (str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'store';
}

function getAllSlugs() {
  try { return JSON.parse(localStorage.getItem(LIST_KEY)) || []; }
  catch (e) { return []; }
}

function saveStore(slug, data) {
  localStorage.setItem(STORAGE_PREFIX + slug, JSON.stringify(data));
  const list = getAllSlugs();
  if (!list.includes(slug)) {
    list.push(slug);
    localStorage.setItem(LIST_KEY, JSON.stringify(list));
  }
}

function getStore(slug) {
  try { return JSON.parse(localStorage.getItem(STORAGE_PREFIX + slug)); }
  catch (e) { return null; }
}

function deleteStore(slug) {
  localStorage.removeItem(STORAGE_PREFIX + slug);
  const list = getAllSlugs().filter(s => s !== slug);
  localStorage.setItem(LIST_KEY, JSON.stringify(list));
}

function uniqueSlug(base) {
  let slug = slugify(base);
  let candidate = slug;
  let i = 2;
  while (getStore(candidate)) {
    candidate = `${slug}-${i}`;
    i++;
  }
  return candidate;
}

function formatPrice(cents) {
  return '$' + (Math.round(cents) / 100).toFixed(2);
}

function generateToken() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

function findByManageToken(token) {
  const slugs = getAllSlugs();
  for (const s of slugs) {
    const store = getStore(s);
    if (store && store.manageToken === token) {
      return { slug: s, store };
    }
  }
  return null;
}

function seedFeaturedStores() {
  if (!getStore('kowhai-candles')) {
    saveStore('kowhai-candles', {
      shopName: 'Kōwhai Candle Co.',
      productName: 'Soy Candle — Kōwhai & Bergamot',
      priceCents: 2400,
      quantityTotal: 30,
      quantitySold: 22,
      photo: 'https://images.unsplash.com/photo-1602874801007-bd458bb1b8b6?w=800&q=80',
      description: 'Hand-poured soy candle in a reused glass jar, scented with kōwhai flower and bergamot. Burns for around 40 hours.',
      delivery: 'Ships NZ-wide in 3 business days, $5 flat rate.',
      about: 'Made in small batches at the kitchen table most Sunday nights.',
      instagram: '', website: '',
      stripeConnected: true, stripeAccountId: 'acct_mock_kowhai01',
      manageToken: 'demo-token-kowhai',
      tier: 'free', status: 'published_locked'
    });
  }
  if (!getStore('marsh-prints')) {
    saveStore('marsh-prints', {
      shopName: 'Marsh & Co',
      productName: 'Limited Print — "Low Tide"',
      priceCents: 6500,
      quantityTotal: 20,
      quantitySold: 20,
      photo: 'https://images.unsplash.com/photo-1515405295579-ba7b45403062?w=800&q=80',
      description: 'A2 giclée print, numbered edition of 20, signed on the back.',
      delivery: 'Posted flat in a rigid mailer, $8 within NZ.',
      about: 'One-off print run — once they\'re gone, they\'re gone.',
      instagram: '', website: '',
      stripeConnected: true, stripeAccountId: 'acct_mock_marsh02',
      manageToken: 'demo-token-marsh',
      tier: 'upgraded', status: 'published_editable'
    });
  }
  if (!getStore('baileys-bakes')) {
    saveStore('baileys-bakes', {
      shopName: "Bailey's Bakes",
      productName: 'Banana Bread Loaf',
      priceCents: 800,
      quantityTotal: 10,
      quantitySold: 10,
      photo: 'https://images.unsplash.com/photo-1605286978633-2dec93ff88a2?w=800&q=80',
      description: 'A honesty-box regular — one loaf, baked Thursday nights for the Friday morning school run.',
      delivery: 'Pickup from the stand on Silverdale Rd.',
      about: 'Started as a way to use up ripe bananas. Now it\'s a whole thing.',
      instagram: '', website: '',
      stripeConnected: true, stripeAccountId: 'acct_mock_baileys03',
      manageToken: 'demo-token-baileys',
      tier: 'free', status: 'published_locked'
    });
  }
}

function seedExample() {
  if (!getStore('example')) {
    saveStore('example', {
      shopName: 'Fen & Clay',
      productName: 'Speckled Stoneware Mug',
      priceCents: 3800,
      quantityTotal: 4,
      quantitySold: 0,
      photo: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800&q=80',
      description: 'Wheel-thrown stoneware, glazed in a warm speckled white with a raw clay footring. Holds 350ml. Each one comes out of the kiln slightly different.',
      delivery: 'Ships within NZ in 2–4 business days, $6 flat rate. Local pickup available in Ōrewa by arrangement.',
      about: 'Fen & Clay is a one-person studio working out of a converted garage on the Hibiscus Coast.',
      instagram: '',
      website: '',
      stripeConnected: true,
      stripeAccountId: 'acct_mock_demo123',
      manageToken: 'demo-token-example',
      tier: 'free',
      status: 'published_locked'
    });
  }
}
