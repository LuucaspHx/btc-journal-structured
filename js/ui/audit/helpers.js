import { getEffectiveTxStatus, getTxSats } from '../table/helpers.js';

export const AUDIT_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'with-txid', label: 'Com TXID' },
  { id: 'validated', label: 'Validados' },
  { id: 'pending', label: 'Pendentes' },
  { id: 'issues', label: 'Divergentes' },
  { id: 'manual', label: 'Manuais' }
];

export const AUDIT_TABLE_DEFAULT_LIMIT = 10;
export const AUDIT_TABLE_STEP = 10;
export const AUDIT_TABLE_MAX = 200;

export const AUDIT_DISTRIBUTION = [
  { id: 'validated', label: 'Validados', statuses: ['confirmed'], tone: 'success' },
  { id: 'pending', label: 'Pendentes', statuses: ['pending'], tone: 'info' },
  { id: 'partial', label: 'Parciais', statuses: ['inconclusive'], tone: 'warn' },
  { id: 'issues', label: 'Divergentes', statuses: ['mismatch', 'invalid'], tone: 'error' },
  { id: 'manual', label: 'Manuais', statuses: ['manual'], tone: 'muted' }
];

export function aggregateAuditBy(entries = [], resolver) {
  const map = new Map();
  entries.forEach((tx) => {
    const raw = resolver(tx);
    const key = raw && String(raw).trim() ? String(raw).trim() : '—';
    const bucket = map.get(key) || {
      label: key,
      count: 0,
      totalSats: 0,
      validated: 0,
      pending: 0,
      issues: 0,
      manual: 0
    };
    bucket.count += 1;
    bucket.totalSats += getTxSats(tx);
    const status = getEffectiveTxStatus(tx);
    if (status === 'confirmed') bucket.validated += 1;
    else if (status === 'pending' || status === 'inconclusive') bucket.pending += 1;
    else if (status === 'mismatch' || status === 'invalid') bucket.issues += 1;
    else bucket.manual += 1;
    map.set(key, bucket);
  });

  return Array.from(map.values())
    .sort((a, b) => {
      if (b.issues !== a.issues) return b.issues - a.issues;
      if (b.pending !== a.pending) return b.pending - a.pending;
      if (b.validated !== a.validated) return b.validated - a.validated;
      return b.totalSats - a.totalSats;
    })
    .slice(0, 5);
}

export function matchesAuditFilter(tx, filterId = 'all') {
  if (filterId === 'all') return true;
  const status = getEffectiveTxStatus(tx);
  switch (filterId) {
    case 'with-txid':
      return Boolean(tx.txid);
    case 'validated':
      return status === 'confirmed';
    case 'pending':
      return status === 'pending';
    case 'issues':
      return status === 'mismatch' || status === 'invalid';
    case 'manual':
      return !tx.txid;
    default:
      return true;
  }
}

export function filterAuditEntries(entries = [], filterId = 'all') {
  return entries.filter((tx) => matchesAuditFilter(tx, filterId));
}

export function getAuditFilterCount(filterId = 'all', totals = {}) {
  switch (filterId) {
    case 'with-txid':
      return totals.withTxid || 0;
    case 'validated':
      return totals.validated || 0;
    case 'pending':
      return totals.pending || 0;
    case 'issues':
      return (totals.mismatch + totals.invalid) || 0;
    case 'manual':
      return totals.manual || 0;
    default:
      return totals.total || 0;
  }
}
