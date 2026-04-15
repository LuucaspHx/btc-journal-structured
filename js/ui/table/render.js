import {
  getTxDate,
  getTxFiat,
  getTxNote,
  getTxPrice,
  getTxSats,
  formatPnL,
  formatCurrentValue,
} from './helpers.js';
import { calcEntryPnL } from '../../core/calculations.js';

export function updateFiltersMeta({
  visibleCount = 0,
  totalCount = 0,
  activeCount = 0,
  sort = 'date-desc',
  describeSortLabel,
} = {}) {
  const card = document.getElementById('filtersCard');
  const meta = document.getElementById('filtersMeta');
  if (card) card.classList.toggle('filters-active', activeCount > 0);
  if (!meta) return;

  const countEl = meta.querySelector('.filters-count');
  const totalEl = meta.querySelector('.filters-total');
  const sortEl = meta.querySelector('.filters-sort');

  if (countEl) {
    if (activeCount > 0) {
      const plural = activeCount > 1 ? 's' : '';
      countEl.textContent = `${activeCount} filtro${plural} ativo${plural}`;
    } else {
      countEl.textContent = '0 filtros ativos';
    }
  }

  if (totalEl) {
    if (activeCount > 0) {
      totalEl.textContent = `Mostrando ${visibleCount} de ${totalCount} aportes`;
    } else if (totalCount > 0) {
      totalEl.textContent = `Mostrando ${totalCount} aportes`;
    } else {
      totalEl.textContent = 'Sem aportes no momento';
    }
  }

  if (sortEl && typeof describeSortLabel === 'function') {
    sortEl.textContent = describeSortLabel(sort);
  }
}

export function renderTable({
  list = [],
  totalCount = 0,
  activeFiltersCount = 0,
  currentPrice = null,
  currency = 'USD',
  createTxStatusBadge,
  fmtInt,
  fmtPrice,
} = {}) {
  const tbody = document.getElementById('tx-body');
  if (!tbody) return;
  while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

  const rows = Array.isArray(list) ? list : [];
  const metaEl = document.getElementById('transactionsMeta');
  if (metaEl) {
    if (totalCount && rows.length !== totalCount)
      metaEl.textContent = `${rows.length} de ${totalCount} aportes`;
    else metaEl.textContent = `${rows.length} aporte${rows.length === 1 ? '' : 's'}`;
  }

  if (rows.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 8;
    td.className = 'muted';
    td.textContent = activeFiltersCount
      ? 'Nenhuma transação corresponde aos filtros.'
      : 'Nenhum aporte cadastrado ainda.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  for (const tx of rows) {
    const tr = document.createElement('tr');

    const tdDate = document.createElement('td');
    tdDate.textContent = getTxDate(tx);

    const tdSats = document.createElement('td');
    tdSats.className = 'num';
    tdSats.textContent = fmtInt(getTxSats(tx));

    const tdPrice = document.createElement('td');
    tdPrice.className = 'num';
    tdPrice.textContent = fmtPrice(getTxPrice(tx));

    const tdPnl = document.createElement('td');
    tdPnl.className = 'num pnl-cell';
    if (currentPrice != null) {
      const pnlData = calcEntryPnL(tx, currentPrice);
      const fmt = formatPnL(pnlData, currency);
      const valueEl = document.createElement('span');
      valueEl.className = 'pnl-value';
      valueEl.textContent = formatCurrentValue(pnlData.currentValue, currency);
      const pctEl = document.createElement('span');
      pctEl.className = `pnl-pct ${pnlData.isProfit ? 'pnl-profit' : 'pnl-loss'}`;
      pctEl.textContent = `${fmt.sign} ${fmt.pctText}`;
      tdPnl.appendChild(valueEl);
      tdPnl.appendChild(pctEl);
    } else {
      tdPnl.textContent = '—';
      tdPnl.className = 'num pnl-cell muted';
    }

    const tdStatus = document.createElement('td');
    tdStatus.className = 'tx-status-cell';
    tdStatus.appendChild(createTxStatusBadge(tx));
    if (tx.validation?.explorerUrl) {
      const link = document.createElement('a');
      link.href = tx.validation.explorerUrl;
      link.target = '_blank';
      link.rel = 'noreferrer noopener';
      link.className = 'tx-status-link';
      link.textContent = 'Ver';
      tdStatus.appendChild(link);
    }

    const tdClassification = document.createElement('td');
    const classParts = [];
    if (tx.strategy) classParts.push(tx.strategy);
    if (Array.isArray(tx.tags) && tx.tags.length) classParts.push(`#${tx.tags.join(', #')}`);
    tdClassification.textContent = classParts.length ? classParts.join(' • ') : '—';

    const tdNote = document.createElement('td');
    tdNote.textContent = getTxNote(tx);

    const tdAct = document.createElement('td');
    tdAct.style.display = 'flex';
    tdAct.style.gap = '6px';
    const editBtn = document.createElement('button');
    editBtn.className = 'edit';
    editBtn.dataset.id = tx.id;
    editBtn.textContent = 'Editar';
    const delBtn = document.createElement('button');
    delBtn.className = 'del';
    delBtn.dataset.id = tx.id;
    delBtn.textContent = 'Apagar';
    tdAct.appendChild(editBtn);
    tdAct.appendChild(delBtn);
    if (tx.txid) {
      const validateBtn = document.createElement('button');
      validateBtn.className = 'validate';
      validateBtn.dataset.id = tx.id;
      validateBtn.textContent = 'Validar TXID';
      tdAct.appendChild(validateBtn);
    }

    tr.appendChild(tdDate);
    tr.appendChild(tdSats);
    tr.appendChild(tdPrice);
    tr.appendChild(tdPnl);
    tr.appendChild(tdStatus);
    tr.appendChild(tdClassification);
    tr.appendChild(tdNote);
    tr.appendChild(tdAct);

    tbody.appendChild(tr);
  }
}

export function renderStats({
  list = [],
  totalCount = 0,
  getLatestMarketPrice,
  currentFiatCurrency,
  fmtCurrency,
  fmtSignedCurrency,
  fmtPercent,
  fmtInt,
} = {}) {
  const container = document.getElementById('stats');
  if (!container) return;

  const txs = Array.isArray(list) ? list : [];
  const openTxs = txs.filter((tx) => !tx?.closed);
  const totalSats = openTxs.reduce((acc, tx) => acc + getTxSats(tx), 0);
  const investedFiat = openTxs.reduce((acc, tx) => {
    const fiat = getTxFiat(tx);
    const fee = Number(tx.fee);
    const safeFiat = Number.isFinite(fiat) ? fiat : 0;
    const safeFee = Number.isFinite(fee) ? fee : 0;
    return acc + safeFiat + safeFee;
  }, 0);
  const btcAmount = totalSats / 1e8;
  const hasHoldings = btcAmount > 0;
  const avgPrice = btcAmount > 0 ? investedFiat / btcAmount : 0;
  const marketPrice = getLatestMarketPrice();
  const currentValue =
    marketPrice && hasHoldings ? marketPrice * btcAmount : hasHoldings ? null : 0;
  const pnlAbs =
    currentValue != null && hasHoldings ? currentValue - investedFiat : hasHoldings ? null : 0;
  const pnlPct =
    pnlAbs != null && hasHoldings && investedFiat > 0
      ? (pnlAbs / investedFiat) * 100
      : hasHoldings
        ? null
        : 0;
  const currency = currentFiatCurrency();
  const hasOpenPositions = openTxs.length > 0;
  const zeroCurrency = fmtCurrency(0, currency);
  const zeroSignedCurrency = fmtSignedCurrency(0, currency);
  const zeroPercent = fmtPercent(0);
  const allowZeroFallback = hasOpenPositions && !hasHoldings;

  const setKpiValue = (id, value, fallback = '—') => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value ?? fallback;
  };

  setKpiValue(
    'kpiInvested',
    hasOpenPositions ? (fmtCurrency(investedFiat, currency) ?? zeroCurrency) : null
  );
  setKpiValue('kpiSats', totalSats > 0 ? fmtInt(totalSats) : '0');
  setKpiValue(
    'kpiAvg',
    avgPrice > 0 ? fmtCurrency(avgPrice, currency) : allowZeroFallback ? zeroCurrency : null
  );
  setKpiValue(
    'kpiCurrent',
    hasOpenPositions && currentValue != null
      ? fmtCurrency(currentValue, currency)
      : allowZeroFallback
        ? zeroCurrency
        : null
  );
  setKpiValue(
    'kpiPL',
    hasOpenPositions && pnlAbs != null
      ? fmtSignedCurrency(pnlAbs, currency)
      : allowZeroFallback
        ? zeroSignedCurrency
        : null
  );
  setKpiValue(
    'kpiPLPct',
    hasOpenPositions && pnlPct != null ? fmtPercent(pnlPct) : allowZeroFallback ? zeroPercent : null
  );

  try {
    const planBtn = document.getElementById('openPlanilhaBtn');
    if (planBtn) {
      planBtn.setAttribute('aria-label', `Abrir Marcadores de Aportes — ${totalCount} aportes`);
      if (!planBtn.disabled && planBtn.getAttribute('aria-disabled') !== 'true') {
        planBtn.classList.toggle('has-data', totalCount > 0);
      } else {
        planBtn.classList.remove('has-data');
      }
    }
  } catch (err) {
    // noop
  }

  let meta = document.getElementById('statsMeta');
  if (!meta) {
    meta = document.createElement('div');
    meta.id = 'statsMeta';
    container.appendChild(meta);
  }
  meta.className = 'muted stats-meta';
  try {
    meta.style.gridColumn = '1 / -1';
  } catch (err) {
    // noop
  }
  meta.textContent =
    totalCount && txs.length !== totalCount
      ? `Mostrando ${txs.length} de ${totalCount} aportes (filtros ativos).`
      : `Total de aportes: ${totalCount}`;
}
