const AUDIT_STATUS_ORDER = [
  'mismatch',
  'invalid',
  'inconclusive',
  'pending',
  'confirmed',
  'manual'
];

function getStatusFromTx(tx = {}) {
  if (tx?.validation?.status) return tx.validation.status;
  if (tx?.status) return tx.status;
  return tx?.txid ? 'pending' : 'manual';
}

function getSatsFromTx(tx = {}) {
  if (Number.isFinite(tx?.sats)) return Number(tx.sats);
  if (Number.isFinite(tx?.btcAmount)) return Math.floor(Number(tx.btcAmount) * 1e8);
  return 0;
}

export function computeAuditMetrics(list = []) {
  const totals = {
    total: list.length,
    withTxid: 0,
    validated: 0,
    pending: 0,
    mismatch: 0,
    invalid: 0,
    inconclusive: 0,
    manual: 0
  };
  const satsAgg = { total: 0, withTxid: 0, validated: 0 };
  const byStatus = {};
  AUDIT_STATUS_ORDER.forEach((status) => {
    byStatus[status] = { count: 0, sats: 0, entries: [] };
  });
  const entries = [];
  for (const tx of list || []) {
    const status = getStatusFromTx(tx);
    const satsValue = getSatsFromTx(tx);
    satsAgg.total += satsValue;
    if (tx?.txid) {
      totals.withTxid += 1;
      satsAgg.withTxid += satsValue;
    } else {
      totals.manual += 1;
    }
    switch (status) {
      case 'confirmed':
        totals.validated += 1;
        satsAgg.validated += satsValue;
        break;
      case 'pending':
        totals.pending += 1;
        break;
      case 'mismatch':
        totals.mismatch += 1;
        break;
      case 'invalid':
        totals.invalid += 1;
        break;
      case 'inconclusive':
        totals.inconclusive += 1;
        break;
      default:
        break;
    }
    const bucket = byStatus[status] || (byStatus[status] = { count: 0, sats: 0, entries: [] });
    bucket.count += 1;
    bucket.sats += satsValue;
    bucket.entries.push(tx);
    entries.push(tx);
  }
  totals.manual = Math.max(0, totals.total - totals.withTxid);
  totals.proofPercent = totals.total ? Math.round((totals.withTxid / totals.total) * 100) : 0;
  totals.validatedPercent = totals.total ? Math.round((totals.validated / totals.total) * 100) : 0;
  satsAgg.proofPercent = satsAgg.total ? Math.round((satsAgg.withTxid / satsAgg.total) * 100) : 0;
  satsAgg.validatedPercent = satsAgg.total ? Math.round((satsAgg.validated / satsAgg.total) * 100) : 0;
  return { totals, satsAgg, entries, byStatus };
}

export function getAuditPriority(tx) {
  const status = getStatusFromTx(tx);
  const idx = AUDIT_STATUS_ORDER.indexOf(status);
  return idx === -1 ? AUDIT_STATUS_ORDER.length : idx;
}

export const __test__ = { getStatusFromTx, getSatsFromTx };
