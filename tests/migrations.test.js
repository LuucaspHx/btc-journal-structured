import { detectOldKey, migrateV1ToV3 } from '../js/storage/migrations.js';
import { installMockStorage } from './helpers/localStorageMock.js';

describe('storage/migrations', () => {
  beforeEach(() => {
    installMockStorage();
  });

  test('detectOldKey reads legacy storage key', () => {
    localStorage.setItem('btcJournalV1', '[{"id":"old"}]');
    expect(detectOldKey()).toBe('[{"id":"old"}]');
  });

  test('migrateV1ToV3 converts array payloads', () => {
    const raw = JSON.stringify([{ id: '1', date: '2025-01-01', price: 100, fiat: 100, sats: 1 }]);
    const migrated = migrateV1ToV3(raw);
    expect(migrated).toEqual({
      txs: [{
        id: '1',
        date: '2025-01-01',
        sats: 1,
        price: 100,
        fiat: 100,
        note: ''
      }]
    });
  });

  test('migrateV1ToV3 handles object entries', () => {
    const raw = JSON.stringify({ entries: [{ date: '2024-12-24', fiat: 50, txid: 'hash' }] });
    const migrated = migrateV1ToV3(raw);
    expect(migrated.txs[0]).toMatchObject({
      date: '2024-12-24',
      fiat: 50,
      note: 'hash'
    });
  });

  test('migrateV1ToV3 returns null for invalid JSON', () => {
    expect(migrateV1ToV3('not json')).toBeNull();
  });
});
