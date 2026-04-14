import { computeAuditMetrics, getAuditPriority } from '../js/core/audit.js';

const entry = (overrides = {}) => ({
  id: overrides.id || 'tx',
  txid: overrides.txid,
  sats: overrides.sats ?? 1000,
  status: overrides.status,
  validation: overrides.validation
});

describe('core/audit', () => {
  test('computeAuditMetrics calcula totais, percentuais e agrupamentos', () => {
    const txs = [
      entry({ txid: 'a', status: 'confirmed', sats: 1000 }),
      entry({ txid: 'b', status: 'pending', sats: 2000 }),
      entry({ status: 'manual', sats: 500 })
    ];
    const { totals, satsAgg, byStatus } = computeAuditMetrics(txs);
    expect(totals.total).toBe(3);
    expect(totals.withTxid).toBe(2);
    expect(totals.validated).toBe(1);
    expect(totals.pending).toBe(1);
    expect(totals.manual).toBe(1);
    expect(totals.proofPercent).toBe(Math.round((2 / 3) * 100));
    expect(satsAgg.total).toBe(3500);
    expect(satsAgg.validated).toBe(1000);
    expect(satsAgg.validatedPercent).toBe(Math.round((1000 / 3500) * 100));
    expect(byStatus.confirmed.count).toBe(1);
    expect(byStatus.pending.count).toBe(1);
    expect(byStatus.manual.count).toBe(1);
  });

  test('getAuditPriority segue ordem de risco', () => {
    const mism = entry({ status: 'mismatch' });
    const conf = entry({ status: 'confirmed' });
    const manual = entry({});
    expect(getAuditPriority(mism)).toBeLessThan(getAuditPriority(conf));
    expect(getAuditPriority(conf)).toBeLessThan(getAuditPriority(manual));
  });
});
