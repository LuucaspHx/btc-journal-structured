import { jest } from '@jest/globals';
import {
  loadState,
  saveState,
  backupLocalData,
  saveStateWithBackups,
  listBackups,
  restoreBackupByKey,
} from '../js/storage/local-db.js';
import { installMockStorage } from './helpers/localStorageMock.js';

describe('storage/local-db', () => {
  beforeEach(() => {
    installMockStorage();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('loadState returns parsed object or fallback', () => {
    const sample = { txs: [{ id: 'a' }] };
    localStorage.setItem('customKey', JSON.stringify(sample));
    expect(loadState('customKey')).toEqual(sample);
    const fallback = { txs: [] };
    expect(loadState('missingKey', fallback)).toBe(fallback);
  });

  test('saveState serializes data into localStorage', () => {
    const data = { txs: [{ id: 'z' }] };
    const ok = saveState(data, 'anotherKey');
    expect(ok).toBe(true);
    expect(localStorage.getItem('anotherKey')).toBe(JSON.stringify(data));
  });

  test('backupLocalData stores timestamped snapshot', () => {
    const legacy = JSON.stringify([{ id: 'legacy' }]);
    localStorage.setItem('btcJournalV1', legacy);
    jest.useFakeTimers().setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
    const ok = backupLocalData('btcJournalV1');
    expect(ok).toBe(true);
    const key = 'btcJournalV1.bak.2025-01-01T00-00-00-000Z';
    expect(localStorage.getItem(key)).toBe(legacy);
  });

  test('saveStateWithBackups preserves the previous state before replacement', () => {
    const previous = { txs: [{ id: 'before' }] };
    const next = { txs: [{ id: 'after' }] };
    localStorage.setItem('journal', JSON.stringify(previous));
    jest.useFakeTimers().setSystemTime(new Date('2025-01-01T00:00:00.000Z'));

    expect(saveStateWithBackups(next, { lsKey: 'journal' })).toEqual({ ok: true });
    expect(loadState('journal')).toEqual(next);
    expect(loadState('journal.bak.2025-01-01T00-00-00-000Z')).toEqual(previous);
  });

  test('saveStateWithBackups aborts replacement when a backup cannot be written', () => {
    const previous = JSON.stringify({ txs: [{ id: 'before' }] });
    localStorage.setItem('journal', previous);
    const originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (key, value) => {
      if (key.startsWith('journal.bak.')) throw new Error('quota');
      originalSetItem(key, value);
    };

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(saveStateWithBackups({ txs: [{ id: 'after' }] }, { lsKey: 'journal' })).toMatchObject({
      ok: false,
      stage: 'backup',
    });
    expect(localStorage.getItem('journal')).toBe(previous);
    errorSpy.mockRestore();
  });

  test('listBackups returns keys ordered desc', () => {
    localStorage.setItem('btcJournalV1.bak.2024-A', '[]');
    localStorage.setItem('btcJournalV1.bak.2025-B', '[]');
    const keys = listBackups();
    expect(keys).toEqual(['btcJournalV1.bak.2025-B', 'btcJournalV1.bak.2024-A']);
  });

  test('restoreBackupByKey parses stored payload', () => {
    localStorage.setItem('btcJournalV1.bak.demo', '{"foo":123}');
    const restored = restoreBackupByKey('btcJournalV1.bak.demo');
    expect(restored).toEqual({ foo: 123 });
    expect(restoreBackupByKey('missing')).toBeNull();
  });
});
