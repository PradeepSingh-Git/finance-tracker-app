/* =============================================
   upload.js — AI-powered document scanning
   ============================================= */

// ── Config ─────────────────────────────────────
// The API key is injected by the Claude.ai environment when running inside an artifact.
// When self-hosting, set your key here or via an environment variable on the server.
const ANTHROPIC_API_URL = '/api/analyze';
const CLAUDE_MODEL      = 'claude-sonnet-4-20250514';

const EXTRACTION_PROMPT = `You are a financial document analyzer.
Extract financial information from this document image.
Respond ONLY with a valid JSON object — no markdown, no backticks, no preamble.
Use these exact fields:
  name        — descriptive name for the account or investment
  type        — one of: investment | savings | debt | loan
  institution — bank or institution name
  value       — numeric value (just the number, in the document's currency)
  notes       — brief notes such as account number, interest rate, ISIN, or maturity

If you cannot determine a value use 0.
If the image is not a financial document return: {"error": "Not a financial document"}`;

// ── File upload handler ────────────────────────
async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const resultDiv = document.getElementById('upload-result');

  // Convert file to base64
  const b64 = await fileToBase64(file);

  // Show preview + loading state
  resultDiv.innerHTML = `
    <img src="data:${file.type};base64,${b64}" class="preview-img" alt="Uploaded document" />
    <div class="ai-loading">
      <div class="spinner"></div>
      Analyzing document with AI…
    </div>
  `;

  try {
    const parsed = await analyzeDocument(b64, file.type);

    if (parsed.error) {
      resultDiv.innerHTML = `
        <div class="ai-result" style="color:var(--c-debt);">
          Could not extract financial data: ${parsed.error}
        </div>`;
      return;
    }

    resultDiv.innerHTML = `
      <img src="data:${file.type};base64,${b64}" class="preview-img" alt="Uploaded document" />
      <div class="ai-result">
        <strong style="color:var(--c-accent);">✓ Data extracted successfully.</strong>
        Review the details below and save to your portfolio.
      </div>`;

    showExtractedForm(parsed);

  } catch (err) {
    resultDiv.innerHTML = `
      <div class="ai-result" style="color:var(--c-debt);">
        Error contacting AI: ${err.message}
      </div>`;
  }

  // Reset file input so the same file can be re-uploaded if needed
  event.target.value = '';
}

// ── Anthropic API call ─────────────────────────
async function analyzeDocument(b64, mediaType) {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
          { type: 'text', text: EXTRACTION_PROMPT },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${response.status}`);
  }

  const data  = await response.json();
  const text  = data.content.map(c => c.text || '').join('');
  const clean = text.replace(/```json|```/g, '').trim();

  try { return JSON.parse(clean); }
  catch { throw new Error('Could not parse AI response as JSON.'); }
}

// ── Render editable extracted form ────────────
function showExtractedForm(parsed) {
  const card = document.getElementById('extracted-form-card');
  card.style.display = 'block';

  const typeOptions = ['investment', 'savings', 'debt', 'loan']
    .map(t => `<option value="${t}" ${parsed.type === t ? 'selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`)
    .join('');

  document.getElementById('extracted-form-grid').innerHTML = `
    <div class="form-group">
      <label>Entry name</label>
      <input type="text" id="ex-name" value="${sanitize(parsed.name || '')}" />
    </div>
    <div class="form-group">
      <label>Type</label>
      <select id="ex-type">${typeOptions}</select>
    </div>
    <div class="form-group">
      <label>Institution</label>
      <input type="text" id="ex-institution" value="${sanitize(parsed.institution || '')}" />
    </div>
    <div class="form-group">
      <label>Value (€)</label>
      <input type="number" id="ex-value" value="${parsed.value || 0}" min="0" step="0.01" />
    </div>
    <div class="form-group full">
      <label>Notes</label>
      <input type="text" id="ex-notes" value="${sanitize(parsed.notes || '')}" />
    </div>
  `;
}

// ── Save extracted entry ───────────────────────
async function saveExtracted() {
  const name        = document.getElementById('ex-name').value.trim();
  const type        = document.getElementById('ex-type').value;
  const institution = document.getElementById('ex-institution').value.trim();
  const rawVal      = document.getElementById('ex-value').value.replace(',', '.');
  const value       = parseFloat(rawVal);
  const notes       = document.getElementById('ex-notes').value.trim();
  const saveBtn     = document.querySelector('#extracted-form-card .btn-primary');
  const errEl       = document.getElementById('save-error');

  if (errEl) errEl.remove();

  if (!name || !institution || isNaN(value) || value < 0) {
    showSaveError('Please fill in name, institution, and a valid positive value.');
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  try {
    const result = await addHolding({ name, type, institution, value, notes });
    if (!result) throw new Error('Insert failed — open the browser console for details.');

    saveBtn.disabled = false;
    saveBtn.textContent = 'Save to portfolio';
    document.getElementById('extracted-form-card').style.display = 'none';
    document.getElementById('upload-result').innerHTML = `
      <div class="ai-result" style="color:var(--c-accent-dark);">
        <strong>✓ Saved to portfolio!</strong> Switch to the Dashboard to see your updated overview.
      </div>`;
    loadHoldings().then(() => { renderDashboard(); renderRecent(); });
  } catch (err) {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save to portfolio';
    showSaveError('Save failed: ' + err.message);
  }
}

function showSaveError(msg) {
  const actions = document.querySelector('#extracted-form-card .form-actions');
  const div = document.createElement('div');
  div.id = 'save-error';
  div.className = 'auth-message auth-error';
  div.style.marginTop = '8px';
  div.textContent = msg;
  actions.after(div);
}

// ── Utilities ──────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

function sanitize(str) {
  return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
