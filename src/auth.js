/* =============================================
   auth.js — Supabase client & auth UI
   ============================================= */

// window.supabase is the CDN library; sbClient is our initialized instance
let sbClient = null;

function getSupabaseConfig() {
  return {
    url: localStorage.getItem('sb_url') || '',
    key: localStorage.getItem('sb_key') || '',
  };
}

function initSupabase(url, key) {
  sbClient = window.supabase.createClient(url, key);
}

// ── Setup Screen ───────────────────────────────
function showSetupScreen() {
  document.getElementById('auth-overlay').innerHTML = `
    <div class="auth-card">
      <h2 class="auth-title">Connect Supabase</h2>
      <p class="auth-sub">Enter your Supabase project credentials. Find these in your project dashboard under Settings → API.</p>
      <div class="form-group">
        <label>Project URL</label>
        <input type="text" id="sb-url" placeholder="https://your-project.supabase.co" />
      </div>
      <div class="form-group" style="margin-top:12px;">
        <label>Anon / Public Key</label>
        <input type="text" id="sb-key" placeholder="eyJhbGci…" />
      </div>
      <div id="setup-error" class="auth-message auth-error" style="display:none;"></div>
      <button class="btn-primary" style="margin-top:1rem;width:100%;" onclick="saveSupabaseConfig()">Connect</button>
    </div>
  `;
}

async function saveSupabaseConfig() {
  const url   = document.getElementById('sb-url').value.trim();
  const key   = document.getElementById('sb-key').value.trim();
  const errEl = document.getElementById('setup-error');
  errEl.style.display = 'none';

  if (!url || !key) {
    errEl.textContent = 'Please enter both the project URL and anon key.';
    errEl.style.display = 'block';
    return;
  }

  try {
    initSupabase(url, key);
    const { error } = await sbClient.from('holdings').select('id').limit(1);
    if (error && error.code !== 'PGRST116') throw error;
    localStorage.setItem('sb_url', url);
    localStorage.setItem('sb_key', key);
    showAuthScreen();
  } catch (err) {
    errEl.textContent = 'Could not connect: ' + (err.message || 'Check your URL and key.');
    errEl.style.display = 'block';
  }
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

let authBootstrapped = false;

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
  const { url, key } = getSupabaseConfig();
  const signOutButton = document.getElementById('signout-button');

  if (signOutButton) signOutButton.onclick = signOutUser;

  if (!url || !key) {
    showSetupScreen();
    return;
  }

  initSupabase(url, key);

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
