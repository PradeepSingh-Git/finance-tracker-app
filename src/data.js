/* =============================================
   data.js — Holdings state & helper functions
   ============================================= */

// ── State ──────────────────────────────────────
let holdings = [];
let _sbUserId      = null;
let _sbUrl         = '';
let _sbAnonKey     = '';
let _sbAccessToken = '';

function setCurrentUser(userId, supabaseUrl, anonKey, accessToken) {
  _sbUserId      = userId;
  _sbUrl         = supabaseUrl;
  _sbAnonKey     = anonKey;
  _sbAccessToken = accessToken;
}

// ── Persistence (Supabase) ─────────────────────
async function loadHoldings() {
  if (!_sbUrl) return;
  const response = await fetch(
    `${_sbUrl}/rest/v1/holdings?select=*&order=created_at.asc&user_id=eq.${_sbUserId}`,
    {
      headers: {
        'apikey': _sbAnonKey,
        'Authorization': `Bearer ${_sbAccessToken}`,
      },
    }
  );
  if (!response.ok) { console.error('loadHoldings HTTP error:', response.status); return; }
  holdings = await response.json();
}

// Direct fetch for INSERT — bypasses the Supabase JS client's
// internal token-refresh path which can hang indefinitely.
async function addHolding(entry) {
  if (!_sbUserId || !_sbUrl) {
    console.error('addHolding: user not initialised');
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(`${_sbUrl}/rest/v1/holdings`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'apikey': _sbAnonKey,
        'Authorization': `Bearer ${_sbAccessToken}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ ...entry, user_id: _sbUserId }),
    });

    clearTimeout(timer);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('addHolding HTTP error:', response.status, err);
      return null;
    }
    return true;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Network request timed out after 20 s');
    throw err;
  }
}

async function deleteHolding(id) {
  const { error } = await sbClient.from('holdings').delete().eq('id', id);
  if (error) { console.error('deleteHolding:', error); return; }
  holdings = holdings.filter(h => h.id !== id);
}

// ── Derived aggregates ─────────────────────────
function getAssets()      { return holdings.filter(h => h.type === 'investment' || h.type === 'savings'); }
function getLiabilities() { return holdings.filter(h => h.type === 'debt'       || h.type === 'loan'); }
function sumValues(arr)   { return arr.reduce((acc, h) => acc + Number(h.value), 0); }

function totalAssets()      { return sumValues(getAssets()); }
function totalLiabilities() { return sumValues(getLiabilities()); }
function netWorth()         { return totalAssets() - totalLiabilities(); }
function totalInvestments() { return sumValues(holdings.filter(h => h.type === 'investment')); }
function totalSavings()     { return sumValues(holdings.filter(h => h.type === 'savings')); }

// ── Formatting ─────────────────────────────────
function fmt(value) {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(value));
}
