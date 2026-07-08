/*
  Real backend client. Replaces the old localStorage-based app.js now that
  Peg has a live Supabase project behind it. Every store read/write goes
  through an edge function using the service role key server-side — the
  browser only ever holds the publishable key below, which is safe to expose.
*/

const SUPABASE_URL = 'https://lghwzpdbjejggsxagsez.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_I9w3uChzyzGAAbgjWZOVWg_IlGAGwFi';

function functionUrl(name) {
  return `${SUPABASE_URL}/functions/v1/${name}`;
}

async function callFunction(name, { method = 'GET', body, query } = {}) {
  let url = functionUrl(name);
  if (query) {
    const params = new URLSearchParams(query);
    url += `?${params.toString()}`;
  }

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data;
}

// --- Public API ---

async function apiGetStore(slug) {
  return callFunction('get-store', { query: { slug } });
}

async function apiCreateStore(fields) {
  return callFunction('create-store', { method: 'POST', body: fields });
}

async function apiGetStoreByToken(token) {
  return callFunction('get-store-by-token', { query: { token } });
}

async function apiUpdateStore(manageToken, fields) {
  return callFunction('update-store', { method: 'POST', body: { manageToken, ...fields } });
}

async function apiDeleteStore(manageToken) {
  return callFunction('delete-store', { method: 'POST', body: { manageToken } });
}

async function apiPublishStore(manageToken) {
  return callFunction('publish-store', { method: 'POST', body: { manageToken } });
}

async function apiUpgradeStore(manageToken) {
  return callFunction('upgrade-store', { method: 'POST', body: { manageToken } });
}

// --- Small pure helpers (no backend involved) ---

function slugify(str) {
  return (
    (str || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'store'
  );
}

function formatPrice(cents) {
  return '$' + (Math.round(cents) / 100).toFixed(2);
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
