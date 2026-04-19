/* =============================================
   data.js — Holdings state & helper functions
   ============================================= */

// ── State ──────────────────────────────────────
let holdings = [];

// ── Persistence (Supabase) ─────────────────────
async function loadHoldings() {
  const { data, error } = await sbClient
    .from('holdings')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) { console.error('loadHoldings:', error); return; }
  holdings = data || [];
}

async function addHolding(entry) {
  const { data: { session } } = await sbClient.auth.getSession();
  if (!session) { console.error('addHolding: no active session'); return null; }
  const { data, error } = await sbClient
    .from('holdings')
    .insert({ ...entry, user_id: session.user.id })
    .select()
    .single();

  if (error) { console.error('addHolding:', error); return null; }
  holdings.push(data);
  return data;
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
