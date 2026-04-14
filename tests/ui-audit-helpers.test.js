import {
  aggregateAuditBy,
  filterAuditEntries,
  getAuditFilterCount,
  matchesAuditFilter
} from '../js/ui/audit/helpers.js';

const tx = (overrides = {}) => ({
  id: overrides.id || 'tx',
  txid: overrides.txid,
  sats: overrides.sats ?? 1000,
  wallet: overrides.wallet,
  exchange: overrides.exchange,
  strategy: overrides.strategy,
  status: overrides.status,
  validation: overrides.validation
});

describe('ui/audit/helpers', () => {
  test('aggregateAuditBy resume buckets por status e sats', () => {
    const rows = aggregateAuditBy([
      tx({ wallet: 'cold', sats: 1000, status: 'confirmed', txid: 'a' }),
      tx({ wallet: 'cold', sats: 2000, status: 'pending', txid: 'b' }),
      tx({ wallet: 'hot', sats: 500, status: 'manual' })
    ], (entry) => entry.wallet);

    expect(rows).toHaveLength(2);
    expect(rows[0].label).toBe('cold');
    expect(rows[0].count).toBe(2);
    expect(rows[0].totalSats).toBe(3000);
    expect(rows[0].validated).toBe(1);
    expect(rows[0].pending).toBe(1);
  });

  test('matchesAuditFilter e filterAuditEntries respeitam os filtros do card', () => {
    const rows = [
      tx({ txid: 'a', status: 'confirmed' }),
      tx({ txid: 'b', status: 'pending' }),
      tx({ status: 'manual' }),
      tx({ txid: 'c', status: 'mismatch' })
    ];

    expect(matchesAuditFilter(rows[0], 'validated')).toBe(true);
    expect(matchesAuditFilter(rows[2], 'manual')).toBe(true);
    expect(matchesAuditFilter(rows[3], 'issues')).toBe(true);
    expect(filterAuditEntries(rows, 'pending')).toHaveLength(1);
    expect(filterAuditEntries(rows, 'with-txid')).toHaveLength(3);
  });

  test('getAuditFilterCount usa totais corretos por filtro', () => {
    const totals = {
      total: 10,
      withTxid: 8,
      validated: 4,
      pending: 2,
      mismatch: 1,
      invalid: 1,
      manual: 2
    };

    expect(getAuditFilterCount('all', totals)).toBe(10);
    expect(getAuditFilterCount('with-txid', totals)).toBe(8);
    expect(getAuditFilterCount('validated', totals)).toBe(4);
    expect(getAuditFilterCount('pending', totals)).toBe(2);
    expect(getAuditFilterCount('issues', totals)).toBe(2);
    expect(getAuditFilterCount('manual', totals)).toBe(2);
  });
});
