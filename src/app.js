/* =============================================
   app.js — Tab routing, dashboard, holdings UI
   ============================================= */

// ── Tab routing ────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === name)
  );
  document.querySelectorAll('.section').forEach(s =>
    s.classList.remove('active')
  );
  const section = document.getElementById('tab-' + name);
  if (section) section.classList.add('active');

  if (name === 'dashboard') renderDashboard();
  if (name === 'holdings')  renderHoldings();
  if (name === 'add')       renderRecent();
}

// ── Dashboard ──────────────────────────────────
function renderDashboard() {
  const assets = totalAssets();
  const liabs  = totalLiabilities();
  const net    = netWorth();
  const invest = totalInvestments();
  const sav    = totalSavings();

  document.getElementById('metrics-grid').innerHTML = `
    <div class="metric">
      <div class="metric-label">Net worth</div>
      <div class="metric-value green">€${fmt(net)}</div>
      <div class="metric-sub">Assets − liabilities</div>
    </div>
    <div class="metric">
      <div class="metric-label">Total assets</div>
      <div class="metric-value">€${fmt(assets)}</div>
      <div class="metric-sub">Investments + savings</div>
    </div>
    <div class="metric">
      <div class="metric-label">Investments</div>
      <div class="metric-value">€${fmt(invest)}</div>
      <div class="metric-sub">${holdings.filter(h => h.type === 'investment').length} positions</div>
    </div>
    <div class="metric">
      <div class="metric-label">Savings</div>
      <div class="metric-value">€${fmt(sav)}</div>
      <div class="metric-sub">${holdings.filter(h => h.type === 'savings').length} accounts</div>
    </div>
    <div class="metric">
      <div class="metric-label">Total debt</div>
      <div class="metric-value red">€${fmt(liabs)}</div>
      <div class="metric-sub">${getLiabilities().length} liabilities</div>
    </div>
  `;

  renderNetWorthBar(assets, liabs, net);

  // Delay chart creation until after the browser has committed layout,
  // otherwise Chart.js can read zero-width canvases on initial load.
  setTimeout(() => {
    renderPieChart();
    renderLineChart();
    renderBarChart();
    renderDebtBarChart();
    resizeCharts();
  }, 50);
}

function renderNetWorthBar(assets, liabs, net) {
  const ratio = assets > 0 ? ((liabs / assets) * 100).toFixed(1) : '0.0';
  const pct   = assets > 0 ? Math.min(100, (net / assets) * 100) : 0;

  document.getElementById('networth-breakdown').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;">
      <div>
        <div style="font-size:11px;color:var(--c-muted);">Assets</div>
        <div style="font-size:16px;font-weight:500;color:var(--c-accent);">€${fmt(assets)}</div>
      </div>
      <div>
        <div style="font-size:11px;color:var(--c-muted);">Liabilities</div>
        <div style="font-size:16px;font-weight:500;color:var(--c-debt);">€${fmt(liabs)}</div>
      </div>
      <div>
        <div style="font-size:11px;color:var(--c-muted);">Net worth</div>
        <div style="font-size:16px;font-weight:500;">€${fmt(net)}</div>
      </div>
    </div>
    <div style="font-size:11px;color:var(--c-muted);margin-bottom:4px;">
      Debt-to-asset ratio: ${ratio}%
    </div>
    <div class="net-bar">
      <div class="net-fill" style="width:${pct}%;"></div>
    </div>
  `;
}

// ── Add Entry ──────────────────────────────────
async function addEntry() {
  const name        = document.getElementById('f-name').value.trim();
  const type        = document.getElementById('f-type').value;
  const institution = document.getElementById('f-institution').value.trim();
  const value       = parseFloat(document.getElementById('f-value').value);
  const notes       = document.getElementById('f-notes').value.trim();

  if (!name || !institution || isNaN(value) || value < 0) {
    alert('Please fill in name, institution, and a valid value.');
    return;
  }

  const ok = await addHolding({ name, type, institution, value, notes });
  if (!ok) { alert('Failed to save. Check the browser console.'); return; }
  await loadHoldings();
  renderDashboard();

  ['f-name', 'f-institution', 'f-value', 'f-notes'].forEach(id => {
    document.getElementById(id).value = '';
  });

  const toast = document.getElementById('toast-success');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);

  renderRecent();
}

// ── Recent Entries ─────────────────────────────
function renderRecent() {
  const card   = document.getElementById('recent-entries-card');
  const recent = [...holdings].reverse().slice(0, 6);

  if (recent.length === 0) { card.style.display = 'none'; return; }
  card.style.display = 'block';

  document.getElementById('recent-list').innerHTML = recent.map(h => `
    <div class="recent-row">
      <div>
        <span style="font-size:13px;font-weight:500;">${h.name}</span>
        <span style="font-size:11px;color:var(--c-muted);margin-left:8px;">${h.institution}</span>
        <span class="type-badge badge-${h.type}" style="margin-left:8px;">${h.type}</span>
      </div>
      <span style="font-size:13px;font-weight:500;color:${h.type === 'debt' || h.type === 'loan' ? 'var(--c-debt)' : 'var(--c-accent)'};">
        ${h.type === 'debt' || h.type === 'loan' ? '−' : ''}€${fmt(h.value)}
      </span>
    </div>
  `).join('');
}

// ── Holdings Table ─────────────────────────────
function renderHoldings() {
  const typeFilter   = document.getElementById('filter-type').value;
  const searchFilter = document.getElementById('filter-search').value.toLowerCase();

  const filtered = holdings.filter(h =>
    (!typeFilter   || h.type === typeFilter) &&
    (!searchFilter || h.name.toLowerCase().includes(searchFilter) ||
                      h.institution.toLowerCase().includes(searchFilter))
  );

  document.getElementById('no-holdings').style.display =
    filtered.length === 0 ? 'block' : 'none';

  document.getElementById('holdings-body').innerHTML = filtered.map(h => {
    const isLiability = h.type === 'debt' || h.type === 'loan';
    return `
      <tr id="row-${h.id}">
        <td><span style="font-weight:500;">${h.name}</span></td>
        <td><span class="type-badge badge-${h.type}">${h.type}</span></td>
        <td>${h.institution}</td>
        <td style="text-align:right;font-weight:500;color:${isLiability ? 'var(--c-debt)' : 'var(--c-text)'};">
          ${isLiability ? '−' : ''}€${fmt(h.value)}
        </td>
        <td style="color:var(--c-muted);font-size:12px;">${h.notes || '—'}</td>
        <td style="text-align:center;white-space:nowrap;">
          <button class="btn-edit" onclick="editHolding(${h.id})" title="Edit entry">✎</button>
          <button class="btn-delete" onclick="removeHolding(${h.id})" title="Delete entry">×</button>
        </td>
      </tr>
    `;
  }).join('');
}

function editHolding(id) {
  const h = holdings.find(x => x.id === id);
  if (!h) return;
  const typeOptions = ['investment', 'savings', 'debt', 'loan']
    .map(t => `<option value="${t}" ${h.type === t ? 'selected' : ''}>${t}</option>`)
    .join('');
  document.getElementById(`row-${id}`).innerHTML = `
    <td><input class="tbl-input" value="${h.name}" id="ei-name-${id}" /></td>
    <td><select class="tbl-input" id="ei-type-${id}">${typeOptions}</select></td>
    <td><input class="tbl-input" value="${h.institution}" id="ei-inst-${id}" /></td>
    <td><input class="tbl-input" type="number" min="0" step="0.01" value="${h.value}" id="ei-val-${id}" style="text-align:right;" /></td>
    <td><input class="tbl-input" value="${h.notes || ''}" id="ei-notes-${id}" placeholder="—" /></td>
    <td style="text-align:center;white-space:nowrap;">
      <button class="btn-edit btn-save" onclick="saveHolding(${id})">Save</button>
      <button class="btn-delete" onclick="renderHoldings()" title="Cancel">×</button>
    </td>
  `;
}

async function saveHolding(id) {
  const name        = document.getElementById(`ei-name-${id}`).value.trim();
  const type        = document.getElementById(`ei-type-${id}`).value;
  const institution = document.getElementById(`ei-inst-${id}`).value.trim();
  const value       = parseFloat(document.getElementById(`ei-val-${id}`).value);
  const notes       = document.getElementById(`ei-notes-${id}`).value.trim();

  if (!name || !institution || isNaN(value) || value < 0) {
    alert('Please fill in name, institution, and a valid value.');
    return;
  }

  const saveBtn = document.querySelector(`#row-${id} .btn-save`);
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  const ok = await updateHolding(id, { name, type, institution, value, notes });
  if (!ok) {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';
    alert('Failed to save. Check the browser console.');
    return;
  }

  await loadHoldings();
  renderHoldings();
  renderDashboard();
}

async function removeHolding(id) {
  if (!confirm('Delete this entry?')) return;
  await deleteHolding(id);
  renderHoldings();
}

// ── Profile panel ──────────────────────────────
function toggleProfile() {
  const panel   = document.getElementById('profile-panel');
  const overlay = document.getElementById('profile-overlay');
  const isOpen  = panel.classList.contains('open');
  if (isOpen) {
    closeProfile();
  } else {
    renderProfile();
    panel.classList.add('open');
    overlay.classList.add('open');
  }
}

function closeProfile() {
  document.getElementById('profile-panel').classList.remove('open');
  document.getElementById('profile-overlay').classList.remove('open');
}

function renderProfile() {
  const stats = [
    { label: 'Net worth',    value: '€' + fmt(netWorth()),         color: netWorth() >= 0 ? 'var(--c-accent)' : 'var(--c-debt)' },
    { label: 'Total assets', value: '€' + fmt(totalAssets()),      color: '' },
    { label: 'Investments',  value: '€' + fmt(totalInvestments()), color: '' },
    { label: 'Savings',      value: '€' + fmt(totalSavings()),     color: '' },
    { label: 'Total debt',   value: '€' + fmt(totalLiabilities()), color: 'var(--c-debt)' },
    { label: 'Holdings',     value: holdings.length + ' entries',  color: '' },
  ];

  document.getElementById('profile-stats').innerHTML = stats.map(s => `
    <div class="profile-stat">
      <span class="profile-stat-label">${s.label}</span>
      <span class="profile-stat-value" style="color:${s.color || 'var(--c-text)'};">${s.value}</span>
    </div>
  `).join('');
}

// ── Init ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
});
