
// Minimal app module: load/save transactions, render table/stats, import/export with sanitizer
import { normalizeEntry, sanitizeImportPayload, satsFrom } from './import-sanitizer.js';

const LS_KEY = 'btc_journal_state_v3';

let state = { txs: [] };

function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.txs)) state.txs = parsed.txs;
  } catch (e) { console.warn('loadState error', e); }
}

function saveState() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
  catch (e) { console.error('saveState error', e); }
}

const fmtBRL = v => (Number.isFinite(Number(v)) ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—');
const fmtInt = v => (Number.isFinite(Number(v)) ? Number(v).toLocaleString('pt-BR') : '0');

function renderTable() {
  const tbody = document.getElementById('tx-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  for (const tx of state.txs) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${tx.date}</td>
      <td class="num">${fmtInt(tx.sats)}</td>
      <td class="num">${fmtBRL(tx.price)}</td>
      <td>${tx.note ?? ''}</td>
      <td><button class="del" data-id="${tx.id}">Apagar</button></td>
    `;
    tbody.appendChild(tr);
  }
}

function renderStats() {
  const el = document.getElementById('stats');
  if (!el) return;
  const totalSats = state.txs.reduce((acc, t) => acc + Number(t.sats || 0), 0);
  const totalBRL = state.txs.reduce((acc, t) => acc + Number(t.price || 0), 0);
  const brlPerSat = totalSats > 0 ? totalBRL / totalSats : 0;
  el.innerHTML = `
    <div>Total sats: <strong>${fmtInt(totalSats)}</strong></div>
    <div>Investido: <strong>${fmtBRL(totalBRL)}</strong></div>
    <div>Custo médio (BRL/sat): <strong>${brlPerSat.toFixed(6)}</strong></div>
  `;
}

function bindForm() {
  const form = document.getElementById('tx-form');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const date = document.getElementById('tx-date').value;
    const sats = Number(document.getElementById('tx-sats').value);
    const price = Number(document.getElementById('tx-price').value);
    const note = document.getElementById('tx-note').value?.trim();
    if (!date || !sats || !isFinite(sats) || !isFinite(price) || sats <= 0 || price <= 0) {
      showMessage('Preencha data, sats (>0) e preço (>0) corretamente.', 'warn');
      return;
    }
    state.txs.push({ id: uid(), date, sats: Math.floor(sats), price: Number(price), note });
    saveState();
    renderTable();
    renderStats();
    renderChart();
    form.reset();
  });
}

function bindTableActions() {
  const tbody = document.getElementById('tx-body');
  if (!tbody) return;
  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button.del');
    if (!btn) return;
    const id = btn.dataset.id;
    const idx = state.txs.findIndex(t => t.id === id);
    if (idx >= 0) {
      if (!(await confirmModalAsync('Apagar esta transação?'))) return;
      const removed = state.txs.splice(idx, 1)[0];
      saveState();
      renderTable();
      renderStats();
      renderChart();
      // Mostrar opção de desfazer
      showMessage('Transação apagada.', 'info', 6000, 'Desfazer', () => {
        // Restaurar a entrada no início (ou na mesma posição)
        state.txs.splice(idx, 0, removed);
        saveState();
        renderTable();
        renderStats();
        renderChart();
        showMessage('Transação restaurada.', 'success');
      });
    }
  });
}

function bindExport() {
  const btn = document.getElementById('btn-export');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const data = { txs: state.txs };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `btc_journal_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}

function bindImport() {
  const input = document.getElementById('file-import');
  if (!input) return;
  input.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      // sanitizeImportPayload aceita array ou { entries: [...] }
      const res = sanitizeImportPayload(parsed);
      if (!res.ok) {
        showMessage(res.reason || 'Arquivo inválido', 'error');
        input.value = '';
        return;
      }
      if (!(await confirmModalAsync(`Foram encontradas ${res.entries.length} entradas válidas. Substituir os dados locais?`))) { input.value = ''; return; }
      state.txs = res.entries.map(e => ({ id: e.id || uid(), date: e.date, sats: e.sats, price: e.fiat ?? e.price ?? 0, note: e.note ?? '' }));
      saveState();
      renderTable();
      renderStats();
      renderChart();
      showMessage('Importação concluída.', 'success');
    } catch (err) {
      console.error('Import error', err);
      showMessage('Erro ao importar arquivo. Verifique o formato.', 'error');
    }
    input.value = '';
  });
}

// Mensagens/banners UI
function showMessage(text, type = 'info', timeout = 4500, actionLabel = null, actionCallback = null) {
  const container = document.getElementById('messageContainer');
  if (!container) { if (typeof window !== 'undefined' && window.alert) window.alert(text); return; }
  const el = document.createElement('div');
  el.className = `msg ${type}`;
  const btnHtml = `<button class="close" aria-label="fechar">×</button>`;
  const actionHtml = actionLabel ? `<button class="action">${actionLabel}</button>` : '';
  el.innerHTML = `<span>${text}</span>${actionHtml}${btnHtml}`;
  container.appendChild(el);
  const closeBtn = el.querySelector('.close');
  closeBtn.addEventListener('click', () => el.remove());
  if (actionLabel && typeof actionCallback === 'function') {
    const actionBtn = el.querySelector('.action');
    actionBtn.addEventListener('click', () => { try { actionCallback(); } catch (e) { console.error(e); } el.remove(); });
  }
  if (timeout > 0) setTimeout(() => el.remove(), timeout);
}

// Confirm modal async
function confirmModalAsync(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal');
    const msg = document.getElementById('confirmModalMessage');
    const ok = document.getElementById('confirmOkBtn');
    const cancel = document.getElementById('confirmCancelBtn');
    if (!modal || !msg || !ok || !cancel) { resolve(window.confirm(message)); return; }
    msg.textContent = message;
    modal.style.display = 'flex';
    function cleanup() {
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      modal.style.display = 'none';
    }
    function onOk() { cleanup(); resolve(true); }
    function onCancel() { cleanup(); resolve(false); }
    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
  });
}
// Expor para handlers herdados (se necessário)
window.confirmModalAsync = confirmModalAsync;

// Migration: detect old key 'btcJournalV1' and offer migration with backup
function detectAndOfferMigration() {
  try {
    const old = localStorage.getItem('btcJournalV1');
    if (!old) return;
    // Se já existem dados no novo formato, não sobrescrever automaticamente
    const hasNew = localStorage.getItem(LS_KEY);
    const proceed = confirm('Dados antigos detectados (btcJournalV1). Deseja migrar para o novo formato? Será criado um backup antes.');
    if (!proceed) return;
    // criar backup timestamped
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    try { localStorage.setItem(`btcJournalV1.bak.${stamp}`, old); } catch (e) { console.warn('Backup antigo falhou', e); }
    // tentar parse e normalizar
    let parsed;
    try { parsed = JSON.parse(old); } catch (e) { showMessage('Dados antigos inválidos. Migração abortada.', 'error'); return; }
    // Suportar array de entradas ou object { entries: [...] }
    const payload = Array.isArray(parsed) ? { entries: parsed } : (parsed && parsed.entries ? parsed : null);
    if (!payload) { showMessage('Formato de backup antigo não reconhecido.', 'error'); return; }
    const res = sanitizeImportPayload(payload);
    if (!res.ok) { showMessage('Migração detectou entradas inválidas. Nenhuma alteração aplicada.', 'error'); return; }
    // Aplicar migracao: mapear para txs minimal
    state.txs = res.entries.map(e => ({ id: e.id || uid(), date: e.date, sats: e.sats, price: e.fiat ?? e.price ?? 0, note: e.note ?? '' }));
    saveState();
    renderTable();
    renderStats();
    renderChart();
    showMessage('Migração concluída com sucesso. Backup criado.', 'success');
  } catch (err) {
    console.error('Migration error', err);
    showMessage('Erro durante a migração. Veja a consola.', 'error');
  }
}

function boot() {
  loadState();
  // tentar detectar e migrar dados antigos (btcJournalV1)
  detectAndOfferMigration();
  bindForm();
  bindTableActions();
  bindExport();
  bindImport();
  renderTable();
  renderStats();
  // Inicializar chart com dados básicos
  try { renderChart(); } catch (e) { /* ignore if Chart not available yet */ }
  
    // Expandir / Recolher comportamento do gráfico (não altera IDs/funcs existentes)
    const chartSection = document.getElementById('chartSection');
    const chartExpandBtn = document.getElementById('chartExpandBtn');
    if (chartSection && chartExpandBtn) {
      chartExpandBtn.addEventListener('click', () => {
        const expanded = chartSection.classList.toggle('expanded');
        chartExpandBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        chartExpandBtn.textContent = expanded ? 'Recolher' : 'Expandir';
        // se houver uma instância global do chart (renderChart cria uma), tente forçar resize
        try {
          if (window.btcChart && typeof window.btcChart.resize === 'function') {
            // chamar em nextFrame para permitir que o CSS de layout termine
            requestAnimationFrame(() => window.btcChart.resize());
          }
        } catch (err) {
          console.warn('Falha ao redimensionar o gráfico após expandir/recolher', err);
        }
      });
    }
}

document.addEventListener('DOMContentLoaded', boot);

// ------------------ Chart / Fetch helpers ------------------
// Pegue preços históricos (CoinGecko) para BTC vs currency em dias
async function fetchPrices(days = 90) {
  const vs = document.getElementById('vsCurrency')?.value || 'eur';
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=${vs}&days=${days}`);
    if (!res.ok) throw new Error('Erro ao buscar preços');
    const json = await res.json();
    // json.prices => [ [timestamp, price], ... ]
    const arr = (json.prices || []).map(p => ({ t: p[0], p: p[1] }));
    // guardar temporariamente no state
    state.prices = arr;
    return arr;
  } catch (err) {
    console.error('fetchPrices error', err);
    showMessage('Erro ao obter preços históricos.', 'warn');
    return [];
  }
}

// Fetch OHLC (candles) via CoinGecko
async function fetchOHLC(days = 90) {
  const vs = document.getElementById('vsCurrency')?.value || 'eur';
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/coins/bitcoin/ohlc?vs_currency=${vs}&days=${days}`);
    if (!res.ok) throw new Error('Erro ao buscar OHLC');
    const json = await res.json();
    // json: array of [timestamp, open, high, low, close]
    state.ohlc = (json || []).map(d => ({ t: d[0], o: d[1], h: d[2], l: d[3], c: d[4] }));
    return state.ohlc;
  } catch (err) {
    console.error('fetchOHLC error', err);
    showMessage('Erro ao obter dados OHLC.', 'warn');
    state.ohlc = [];
    return [];
  }
}

function pmMedio(entries = []) {
  // Preço médio simples (fiat total / sats total)
  const totalFiat = entries.reduce((s, e) => s + Number(e.price || e.fiat || 0), 0);
  const totalSats = entries.reduce((s, e) => s + Number(e.sats || 0), 0);
  if (totalSats === 0) return 0;
  return totalFiat / totalSats;
}

let _chart = null;
function renderChart() {
  const canvas = document.getElementById('btcChart');
  if (!canvas || typeof Chart === 'undefined') return;
  // Preencher preços se vazio
  if (!Array.isArray(state.prices) || state.prices.length === 0) { fetchPrices(90).then(() => renderChart()); return; }
  const ctx = canvas.getContext('2d');
  const labels = state.prices.map(p => p.t);
  const priceData = state.prices.map(p => p.p);

  // Aportes abertos como pontos (inclui metadados para tooltip)
  const currentPricePoint = (state.prices && state.prices.length) ? state.prices[state.prices.length - 1].p : null;
  const points = (state.txs || []).map(tx => {
    const plPct = (currentPricePoint && tx.price) ? ((currentPricePoint - tx.price) / tx.price) * 100 : 0;
    const color = plPct > 0 ? 'var(--green)' : (plPct < 0 ? 'var(--red)' : 'var(--amber)');
    return { x: new Date(tx.date).getTime(), y: tx.price, sats: tx.sats, note: tx.note, plPct, color };
  });

  const datasets = [];
  // Candles, se disponíveis e modo selecionado
  const mode = document.getElementById('chartMode')?.value || 'line';
  if (mode === 'candles' && Array.isArray(state.ohlc) && state.ohlc.length > 0) {
    const candData = state.ohlc.map(d => ({ x: d.t, o: d.o, h: d.h, l: d.l, c: d.c }));
    datasets.push({ label: 'OHLC', type: 'candlestick', data: candData, fractionalDigitsCount: 2, color: { up: 'rgba(34,197,94,0.95)', down: 'rgba(239,68,68,0.95)' } });
  }

  datasets.push({ label: `BTC/${(document.getElementById('vsCurrency')?.value || 'eur').toUpperCase()}`, data: priceData, parsing: false, borderWidth: 1.2, tension: 0.2, borderColor: 'var(--brand)', type: 'line' });
  // Usar cores por ponto com base no P/L
  const pointColors = points.map(p => p.color || 'var(--green)');
  const pointRadii = points.map(p => Math.min(10, 3 + Math.log10((p.sats || 1) + 1))); // radius ~ sats (capped)
  datasets.push({ type: 'scatter', label: 'Aportes', data: points, pointRadius: pointRadii, backgroundColor: pointColors, borderColor: '#0b1220', borderWidth: 1, order: 10 });

  const data = { labels, datasets };
  // Preço médio para anotar
  const avgPrice = pmMedio(state.txs || []);

  const cfg = {
    type: 'line',
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { x: { type: 'time' }, y: {} },
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            title: function(items) {
              if (!items || !items.length) return '';
              const it = items[0];
              // tentar extrair timestamp
              const t = it.parsed?.x ?? it.label ?? it.parsed;
              const dt = t ? new Date(t) : new Date();
              return dt.toLocaleString('pt-BR', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
            },
            label: function(context) {
              const ds = context.dataset;
              const curr = (document.getElementById('vsCurrency')?.value || 'eur').toUpperCase();
              const formatCurrency = (v) => {
                try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: curr }).format(v); } catch (e) { return v; }
              };
              if (ds.type === 'scatter') {
                const v = context.raw;
                const sats = v.sats ?? '';
                const note = v.note ? ` — ${v.note}` : '';
                return [`Preço: ${formatCurrency(v.y)}${note}`, `Sats: ${Number(sats).toLocaleString('pt-BR')}`];
              }
              // linha de preço
              const value = context.parsed?.y ?? context.formattedValue;
              return `${context.dataset.label}: ${formatCurrency(value)} `;
            }
          }
        }
      }
    }
  };

  // Registrar annotation de PM se o plugin existir
  try {
    if (typeof Chart !== 'undefined' && Chart.registry && Chart.registry.getPlugin && Chart.registry.getPlugin('annotation')) {
      // plugin já registrado via CDN script tag; adicionar annotation dinamicamente
      cfg.options.plugins.annotation = cfg.options.plugins.annotation || { annotations: {} };
      cfg.options.plugins.annotation.annotations.pmLine = {
        type: 'line', yMin: avgPrice, yMax: avgPrice, borderColor: '#9ca3ff', borderWidth: 1.2, borderDash: [6,6], label: { content: `PM ${(avgPrice).toFixed(2)}`, enabled: true, position: 'end' }
      };
    }
  } catch (e) { /* ignore if annotation plugin absent */ }

  if (_chart) try { _chart.destroy(); } catch (e) {}
  _chart = new Chart(ctx, cfg);
  // expor instância globalmente para permitir resize após toggle de layout
  try { window.btcChart = _chart; } catch (e) { /* ignore in strict CSP env */ }

  // Atualizar legenda dinâmica
  updateLegend(points);
}

function updateLegend(points = []) {
  const container = document.getElementById('chartLegend');
  if (!container) return;
  const pos = points.filter(p => p.plPct > 0).length;
  const neg = points.filter(p => p.plPct < 0).length;
  const neu = points.filter(p => p.plPct === 0).length;
  container.innerHTML = `
    <div class="legend-item"><span class="legend-swatch" style="background:var(--green)"></span><span class="legend-label">Positivos: ${pos}</span></div>
    <div class="legend-item"><span class="legend-swatch" style="background:var(--red)"></span><span class="legend-label">Negativos: ${neg}</span></div>
    <div class="legend-item"><span class="legend-swatch" style="background:var(--amber)"></span><span class="legend-label">Neutros: ${neu}</span></div>
  `;
}

// atualizar gráfico quando controles mudarem
document.addEventListener('change', async (e) => {
  if (e.target && e.target.id === 'vsCurrency') {
    await fetchPrices(90);
    if (document.getElementById('chartMode')?.value === 'candles') await fetchOHLC(90);
    renderChart();
  }
  if (e.target && e.target.id === 'chartMode') {
    if (e.target.value === 'candles') await fetchOHLC(90);
    renderChart();
  }
});

