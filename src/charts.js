/* =============================================
   charts.js — Chart.js chart renderers
   ============================================= */

let pieChart, lineChart, barChart, debtBarChart;

function resizeCharts() {
  if (pieChart)     pieChart.resize();
  if (lineChart)    lineChart.resize();
  if (barChart)     barChart.resize();
  if (debtBarChart) debtBarChart.resize();
}

const CHART_COLORS = ['#1D9E75', '#378ADD', '#D85A30', '#EF9F27', '#7F77DD', '#5DCAA5'];

// ── Donut — asset allocation ───────────────────
function renderPieChart() {
  const invest  = totalInvestments();
  const savings = totalSavings();
  const liabs   = totalLiabilities();

  const labels = ['Investments', 'Savings', 'Liabilities'];
  const data   = [invest, savings, liabs];
  const colors = [CHART_COLORS[0], CHART_COLORS[1], CHART_COLORS[2]];

  document.getElementById('alloc-legend').innerHTML = labels
    .map((l, i) => `<span class="legend-item"><span class="legend-dot" style="background:${colors[i]}"></span>${l} €${fmt(data[i])}</span>`)
    .join('');

  if (pieChart) pieChart.destroy();
  pieChart = new Chart(document.getElementById('pieChart'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` €${fmt(ctx.raw)}` } },
      },
    },
  });
}

// ── Line — net worth trend (last 6 months) ─────
function renderLineChart() {
  const months = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'];
  const current = netWorth();
  // Simulate historical trend — replace with real data if available
  const values = [0.81, 0.85, 0.88, 0.92, 0.97, 1.00].map(f => Math.round(current * f));

  if (lineChart) lineChart.destroy();
  lineChart = new Chart(document.getElementById('lineChart'), {
    type: 'line',
    data: {
      labels: months,
      datasets: [{
        label: 'Net worth',
        data: values,
        borderColor: '#1D9E75',
        backgroundColor: 'rgba(29,158,117,0.08)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: '#1D9E75',
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` €${fmt(ctx.raw)}` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: {
          grid: { color: 'rgba(136,135,128,0.12)' },
          ticks: { callback: v => '€' + fmt(v), font: { size: 11 } },
        },
      },
    },
  });
}

// ── Bar — assets by institution ────────────────
function renderBarChart() {
  const instMap = {};
  holdings
    .filter(h => h.type !== 'debt' && h.type !== 'loan')
    .forEach(h => { instMap[h.institution] = (instMap[h.institution] || 0) + h.value; });

  const labels = Object.keys(instMap);
  const values = labels.map(k => Math.round(instMap[k]));
  const colors = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

  document.getElementById('bar-legend').innerHTML = labels
    .map((l, i) => `<span class="legend-item"><span class="legend-dot" style="background:${colors[i]}"></span>${l}</span>`)
    .join('');

  if (barChart) barChart.destroy();
  barChart = new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` €${fmt(ctx.raw)}` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: {
          grid: { color: 'rgba(136,135,128,0.12)' },
          ticks: { callback: v => '€' + fmt(v), font: { size: 11 } },
        },
      },
    },
  });
}

// ── Bar — debt & loans by institution ─────────
function renderDebtBarChart() {
  const instMap = {};
  holdings
    .filter(h => h.type === 'debt' || h.type === 'loan')
    .forEach(h => { instMap[h.institution] = (instMap[h.institution] || 0) + h.value; });

  const labels = Object.keys(instMap);
  const values = labels.map(k => Math.round(instMap[k]));
  const DEBT_COLORS = ['#D85A30', '#C0392B', '#E67E22', '#8E44AD', '#2980B9', '#16A085'];
  const colors = labels.map((_, i) => DEBT_COLORS[i % DEBT_COLORS.length]);

  const card = document.getElementById('debt-bar-card');
  if (labels.length === 0) { card.style.display = 'none'; return; }
  card.style.display = 'block';

  document.getElementById('debt-bar-legend').innerHTML = labels
    .map((l, i) => `<span class="legend-item"><span class="legend-dot" style="background:${colors[i]}"></span>${l}</span>`)
    .join('');

  if (debtBarChart) debtBarChart.destroy();
  debtBarChart = new Chart(document.getElementById('debtBarChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` €${fmt(ctx.raw)}` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: {
          grid: { color: 'rgba(136,135,128,0.12)' },
          ticks: { callback: v => '€' + fmt(v), font: { size: 11 } },
        },
      },
    },
  });
}
