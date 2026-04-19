/* =============================================
   auth.js — Supabase client & auth UI
   ============================================= */

// ── YOUR SUPABASE PROJECT CREDENTIALS ─────────
// Find these in: Supabase dashboard → Settings → API
const SUPABASE_URL      = 'https://xzupmitftejwcndnxrth.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6dXBtaXRmdGVqd2NuZG54cnRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1ODQ3MTgsImV4cCI6MjA5MjE2MDcxOH0.kjm_Aav6w_EIEvBUsC7-5o7ZyBKA0eLh-4fUfOrPNWQ';
// ──────────────────────────────────────────────

let sbClient = null;

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

async function logout() {
  if (sbClient) await sbClient.auth.signOut();
  window.location.reload();
}

// ── Init ───────────────────────────────────────
async function initAuth() {
  initSupabase();

  sbClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN') {
      document.getElementById('auth-overlay').style.display = 'none';
      document.getElementById('user-email').textContent = session.user.email;
      await loadHoldings();
      renderRecent();
      setTimeout(renderDashboard, 50);
    } else if (event === 'SIGNED_OUT') {
      holdings = [];
      document.getElementById('user-email').textContent = '';
      document.getElementById('auth-overlay').style.display = 'flex';
      showAuthScreen();
    }
  });

  const { data: { session } } = await sbClient.auth.getSession();
  if (session) {
    document.getElementById('auth-overlay').style.display = 'none';
    document.getElementById('user-email').textContent = session.user.email;
    await loadHoldings();
    renderRecent();
    setTimeout(renderDashboard, 50);
  } else {
    showAuthScreen();
  }
}
