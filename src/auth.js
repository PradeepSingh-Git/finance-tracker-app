/* =============================================
   auth.js — Supabase client & auth UI
   ============================================= */

// ── YOUR SUPABASE PROJECT CREDENTIALS ─────────
// Find these in: Supabase dashboard → Settings → API
const SUPABASE_URL      = 'https://xzupmitftejwcndnxrth.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6dXBtaXRmdGVqd2NuZG54cnRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1ODQ3MTgsImV4cCI6MjA5MjE2MDcxOH0.kjm_Aav6w_EIEvBUsC7-5o7ZyBKA0eLh-4fUfOrPNWQ';
// ──────────────────────────────────────────────

let sbClient = null;
let authBootstrapped = false;

function initSupabase() {
  sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ── Auth Screen ────────────────────────────────
function showAuthScreen(mode = 'login') {
  const isLogin = mode === 'login';
  document.getElementById('auth-overlay').innerHTML = `
    <div class="auth-card">
      <h2 class="auth-title">Finance Tracker</h2>
      <div class="auth-tabs">
        <button class="auth-tab ${isLogin ? 'active' : ''}" onclick="showAuthScreen('login')">Sign in</button>
        <button class="auth-tab ${!isLogin ? 'active' : ''}" onclick="showAuthScreen('register')">Create account</button>
      </div>
      <div class="form-group" style="margin-top:1rem;">
        <label>Email</label>
        <input type="email" id="auth-email" placeholder="you@example.com" />
      </div>
      <div class="form-group" style="margin-top:12px;">
        <label>Password</label>
        <input type="password" id="auth-password" placeholder="••••••••"
          onkeydown="if(event.key==='Enter') ${isLogin ? 'doLogin()' : 'doRegister()'}" />
      </div>
      <div id="auth-message" class="auth-message" style="display:none;"></div>
      <button class="btn-primary" style="margin-top:1rem;width:100%;"
        onclick="${isLogin ? 'doLogin()' : 'doRegister()'}">
        ${isLogin ? 'Sign in' : 'Create account'}
      </button>
    </div>
  `;
}

async function doLogin() {
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  setAuthMessage('');

  const { error } = await sbClient.auth.signInWithPassword({ email, password });
  if (error) setAuthMessage(error.message, true);
}

async function doRegister() {
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  setAuthMessage('');

  const { error } = await sbClient.auth.signUp({ email, password });
  if (error) {
    setAuthMessage(error.message, true);
  } else {
    setAuthMessage('Account created! Check your email to confirm, then sign in.', false);
  }
}

function setAuthMessage(text, isError = false) {
  const el = document.getElementById('auth-message');
  if (!el) return;
  el.textContent = text;
  el.className = 'auth-message ' + (isError ? 'auth-error' : 'auth-success');
  el.style.display = text ? 'block' : 'none';
}

function clearSupabaseSessionStorage() {
  Object.keys(localStorage)
    .filter(key => key.startsWith('sb-') && key.endsWith('-auth-token'))
    .forEach(key => localStorage.removeItem(key));
}

function resetSignedOutUi() {
  authBootstrapped = false;
  holdings = [];
  document.getElementById('user-email').textContent = '';
  document.getElementById('auth-overlay').style.display = 'flex';
  showAuthScreen();
}

async function signOutUser() {
  if (!sbClient) return;

  clearSupabaseSessionStorage();
  resetSignedOutUi();

  // Attempt the official sign-out in the background, but don't block the UI on it.
  sbClient.auth.signOut({ scope: 'local' }).catch(err => {
    console.error('signOutUser:', err);
  });
}

async function startAuthenticatedSession(session) {
  if (!session || authBootstrapped) return;
  authBootstrapped = true;

  setCurrentUser(session.user.id, SUPABASE_URL, SUPABASE_ANON_KEY, session.access_token);
  document.getElementById('auth-overlay').style.display = 'none';
  document.getElementById('user-email').textContent = session.user.email;

  // Show the dashboard shell immediately, then hydrate it once holdings finish loading.
  switchTab('dashboard');

  await loadHoldings();
  renderRecent();
  renderDashboard();
  setTimeout(renderDashboard, 120);
}

// ── Init ───────────────────────────────────────
async function initAuth() {
  initSupabase();

  const signOutButton = document.getElementById('signout-button');
  if (signOutButton) signOutButton.onclick = signOutUser;

  sbClient.auth.onAuthStateChange(async (event, session) => {
    if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session) {
      await startAuthenticatedSession(session);
    } else if (event === 'SIGNED_OUT') {
      resetSignedOutUi();
    }
  });

  const { data: { session } } = await sbClient.auth.getSession();
  if (session) {
    await startAuthenticatedSession(session);
  } else {
    showAuthScreen();
  }
}
