import { computeAuditMetrics, getAuditPriority } from '../../core/audit.js';
import { getTxDate, getTxFiat, getTxSats, shortTxid } from '../table/helpers.js';
import {
  AUDIT_DISTRIBUTION,
  AUDIT_FILTERS,
  AUDIT_TABLE_MAX,
  aggregateAuditBy,
  filterAuditEntries,
  getAuditFilterCount
} from './helpers.js';

function clearChildren(node) {
  if (!node) return;
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function renderAuditGroup(containerId, items = [], emptyMessage = 'Sem dados', { fmtInt } = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;
  clearChildren(container);
  if (!items.length) {
    const msg = document.createElement('div');
    msg.className = 'muted';
    msg.textContent = emptyMessage;
    container.appendChild(msg);
    return;
  }

  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'audit-group-row';
    const head = document.createElement('div');
    head.className = 'audit-group-head';
    const label = document.createElement('span');
    label.textContent = item.label;
    const count = document.createElement('span');
    count.textContent = item.count;
    head.appendChild(label);
    head.appendChild(count);

    const meta = document.createElement('div');
    meta.className = 'audit-group-meta';
    meta.textContent = `${fmtInt(item.totalSats)} sats`;

    const chips = document.createElement('div');
    chips.className = 'audit-group-chips';

    const addChip = (labelText, countValue, tone) => {
      if (!countValue) return;
      const chip = document.createElement('span');
      chip.className = `audit-chip tone-${tone}`;
      chip.textContent = `${labelText}: ${countValue}`;
      chips.appendChild(chip);
    };

    addChip('✔︎', item.validated, 'success');
    addChip('…', item.pending, 'info');
    addChip('⚠︎', item.issues, 'error');
    addChip('—', item.manual, 'muted');

    row.appendChild(head);
    row.appendChild(meta);
    row.appendChild(chips);
    container.appendChild(row);
  });
}

export function renderAuditPanel({
  txs = [],
  filterId = 'all',
  limit = 10,
  createTxStatusBadge,
  getExplorerUrl,
  fmtInt,
  fmtCurrency,
  currentFiatCurrency
} = {}) {
  const summaryEl = document.getElementById('auditSummary');
  const metaEl = document.getElementById('auditMeta');
  const tableBody = document.getElementById('auditTableBody');
  const filtersEl = document.getElementById('auditFilters');
  const distributionEl = document.getElementById('auditDistribution');
  const showMoreBtn = document.getElementById('auditShowMoreBtn');
  if (!summaryEl || !tableBody) return;

  const metrics = computeAuditMetrics(txs);
  const { totals, satsAgg, entries, byStatus } = metrics;
  const summaryData = [
    { label: 'Total de aportes', value: totals.total || 0 },
    { label: 'Com TXID', value: totals.withTxid || 0, hint: `${totals.proofPercent || 0}%` },
    { label: 'Validados', value: totals.validated || 0, hint: `${totals.validatedPercent || 0}%` },
    { label: 'Pendentes', value: totals.pending || 0 },
    { label: 'Divergentes', value: (totals.mismatch + totals.invalid) || 0 },
    { label: 'Sats validados', value: fmtInt(satsAgg.validated) || '0', hint: `${satsAgg.validatedPercent || 0}%` }
  ];

  clearChildren(summaryEl);
  summaryData.forEach((item) => {
    const pill = document.createElement('div');
    pill.className = 'audit-pill';
    const label = document.createElement('span');
    label.textContent = item.label;
    const value = document.createElement('strong');
    value.textContent = item.value;
    pill.appendChild(label);
    pill.appendChild(value);
    if (item.hint) {
      const hint = document.createElement('span');
      hint.className = 'muted';
      hint.textContent = item.hint;
      pill.appendChild(hint);
    }
    summaryEl.appendChild(pill);
  });

  if (metaEl) {
    metaEl.textContent = totals.total
      ? `${totals.validatedPercent || 0}% validados • ${totals.proofPercent || 0}% com TXID`
      : 'Nenhum aporte cadastrado.';
  }

  if (distributionEl) {
    clearChildren(distributionEl);
    AUDIT_DISTRIBUTION.forEach((cfg) => {
      const aggregate = cfg.statuses.reduce((acc, status) => {
        const bucket = byStatus?.[status];
        if (bucket) {
          acc.count += bucket.count;
          acc.sats += bucket.sats;
        }
        return acc;
      }, { count: 0, sats: 0 });
      const percent = totals.total ? Math.round((aggregate.count / totals.total) * 100) : 0;
      const row = document.createElement('div');
      row.className = `audit-distribution-row tone-${cfg.tone}`;
      const head = document.createElement('div');
      head.className = 'audit-distribution-head';
      const label = document.createElement('span');
      label.textContent = `${cfg.label} (${aggregate.count})`;
      const pct = document.createElement('span');
      pct.textContent = `${percent}%`;
      head.appendChild(label);
      head.appendChild(pct);
      const progress = document.createElement('div');
      progress.className = 'audit-progress';
      const bar = document.createElement('div');
      bar.className = `audit-progress-bar tone-${cfg.tone}`;
      bar.style.width = `${Math.min(100, percent)}%`;
      progress.appendChild(bar);
      row.appendChild(head);
      row.appendChild(progress);
      distributionEl.appendChild(row);
    });
  }

  if (filtersEl) {
    clearChildren(filtersEl);
    AUDIT_FILTERS.forEach((filter) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.filter = filter.id;
      btn.textContent = `${filter.label} (${getAuditFilterCount(filter.id, totals)})`;
      if (filterId === filter.id) btn.classList.add('active');
      btn.disabled = filter.id !== 'all' && getAuditFilterCount(filter.id, totals) === 0;
      filtersEl.appendChild(btn);
    });
  }

  const filteredEntries = filterAuditEntries(entries, filterId);
  renderAuditGroup('auditGroup-wallet', aggregateAuditBy(entries, (tx) => tx.wallet), 'Sem carteiras registradas.', { fmtInt });
  renderAuditGroup('auditGroup-exchange', aggregateAuditBy(entries, (tx) => tx.exchange), 'Sem exchanges registradas.', { fmtInt });
  renderAuditGroup('auditGroup-strategy', aggregateAuditBy(entries, (tx) => tx.strategy), 'Sem estratégias registradas.', { fmtInt });

  clearChildren(tableBody);
  if (!filteredEntries.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.className = 'muted';
    td.textContent = entries.length
      ? 'Nenhum aporte corresponde ao filtro selecionado.'
      : 'Nenhum aporte para exibir.';
    tr.appendChild(td);
    tableBody.appendChild(tr);
    if (showMoreBtn) {
      showMoreBtn.style.display = 'none';
      showMoreBtn.textContent = 'Mostrar mais';
    }
    return;
  }

  const sorted = filteredEntries
    .slice()
    .sort((a, b) => {
      const pri = getAuditPriority(a) - getAuditPriority(b);
      if (pri !== 0) return pri;
      const timeDiff = new Date(getTxDate(b)).getTime() - new Date(getTxDate(a)).getTime();
      return Number.isNaN(timeDiff) ? 0 : timeDiff;
    });

  const safeLimit = Math.min(limit, AUDIT_TABLE_MAX);
  const limited = sorted.slice(0, safeLimit);
  const remaining = Math.max(0, sorted.length - limited.length);

  if (showMoreBtn) {
    if (remaining > 0) {
      showMoreBtn.style.display = 'inline-flex';
      showMoreBtn.textContent = `Mostrar mais (${remaining})`;
    } else {
      showMoreBtn.style.display = 'none';
      showMoreBtn.textContent = 'Mostrar mais';
    }
  }

  limited.forEach((tx) => {
    const tr = document.createElement('tr');

    const tdDate = document.createElement('td');
    tdDate.textContent = getTxDate(tx);

    const tdStatus = document.createElement('td');
    if (typeof createTxStatusBadge === 'function') {
      tdStatus.appendChild(createTxStatusBadge(tx));
    }

    const tdTxid = document.createElement('td');
    if (tx.txid) {
      const link = document.createElement('a');
      link.textContent = shortTxid(tx.txid);
      const explorer = typeof getExplorerUrl === 'function' ? getExplorerUrl(tx) : tx.validation?.explorerUrl;
      link.href = explorer || '#';
      link.target = '_blank';
      link.rel = 'noreferrer noopener';
      tdTxid.appendChild(link);
    } else {
      tdTxid.textContent = '—';
    }

    const tdConclusion = document.createElement('td');
    const declared = document.createElement('span');
    declared.className = 'muted';
    declared.textContent = `Declarado: ${fmtInt(getTxSats(tx))} sats (${fmtCurrency(getTxFiat(tx), currentFiatCurrency()) || '—'})`;
    const found = document.createElement('span');
    found.className = 'muted';
    if (tx.validation?.matchedSats != null || tx.validation?.expectedSats != null) {
      found.textContent = `Explorer: ${fmtInt(tx.validation.matchedSats || 0)} / ${fmtInt(tx.validation.expectedSats || 0)} sats`;
    } else {
      found.textContent = 'Explorer: —';
    }
    const reason = document.createElement('div');
    reason.textContent = tx.validation?.reason || 'Sem validação registrada.';
    tdConclusion.appendChild(reason);
    tdConclusion.appendChild(declared);
    tdConclusion.appendChild(found);
    if (tx.txidLastCheckedAt) {
      const timeLine = document.createElement('span');
      timeLine.className = 'muted';
      const date = new Date(tx.txidLastCheckedAt);
      timeLine.textContent = `Revisado em ${date.toLocaleString('pt-BR')}`;
      tdConclusion.appendChild(timeLine);
    }

    tr.appendChild(tdDate);
    tr.appendChild(tdStatus);
    tr.appendChild(tdTxid);
    tr.appendChild(tdConclusion);
    tableBody.appendChild(tr);
  });
}
