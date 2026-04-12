import { normalizeEntry, sanitizeImportPayload, asNumber, asDateString, satsFrom } from '../js/import-sanitizer.js';

describe('import-sanitizer', () => {
  test('normalizeEntry - happy path', () => {
    const raw = { date: '2025-01-15', price: 65000, fiat: 100, fee: 0 };
    const n = normalizeEntry(raw);
    expect(n).not.toBeNull();
    expect(n.date).toBe('2025-01-15');
    expect(n.price).toBe(65000);
    expect(n.fiat).toBe(100);
    expect(n.sats).toBeGreaterThan(0);
  });

  test('normalizeEntry - invalid price', () => {
    const raw = { date: '2025-01-15', price: 'abc', fiat: 100 };
    const n = normalizeEntry(raw);
    expect(n).toBeNull();
  });

  test('normalizeEntry - txid válido é preservado em lowercase', () => {
    const txid = 'A'.repeat(64); // 64 hex chars maiúsculos
    const raw = { date: '2025-01-15', price: 65000, fiat: 100, txid };
    const n = normalizeEntry(raw);
    expect(n).not.toBeNull();
    expect(n.txid).toBe('a'.repeat(64));
  });

  test('normalizeEntry - txid inválido é descartado', () => {
    const raw = { date: '2025-01-15', price: 65000, fiat: 100, txid: 'nao-e-hex' };
    const n = normalizeEntry(raw);
    expect(n.txid).toBe('');
  });

  test('normalizeEntry - txid com comprimento errado é descartado', () => {
    const raw = { date: '2025-01-15', price: 65000, fiat: 100, txid: 'abc123' };
    const n = normalizeEntry(raw);
    expect(n.txid).toBe('');
  });

  test('normalizeEntry - note é truncado em 500 chars', () => {
    const raw = { date: '2025-01-15', price: 65000, fiat: 100, note: 'x'.repeat(600) };
    const n = normalizeEntry(raw);
    expect(n.note.length).toBe(500);
  });

  test('normalizeEntry - strategy é truncado em 80 chars', () => {
    const raw = { date: '2025-01-15', price: 65000, fiat: 100, strategy: 's'.repeat(100) };
    const n = normalizeEntry(raw);
    expect(n.strategy.length).toBe(80);
  });

  test('normalizeEntry - wallet é truncado em 100 chars', () => {
    const raw = { date: '2025-01-15', price: 65000, fiat: 100, wallet: 'w'.repeat(150) };
    const n = normalizeEntry(raw);
    expect(n.wallet.length).toBe(100);
  });

  test('normalizeEntry - tags array é limitado a 10 itens com max 40 chars cada', () => {
    const raw = {
      date: '2025-01-15', price: 65000, fiat: 100,
      tags: Array.from({ length: 15 }, (_, i) => `tag${i}-${'x'.repeat(50)}`)
    };
    const n = normalizeEntry(raw);
    expect(n.tags.length).toBe(10);
    n.tags.forEach(tag => expect(tag.length).toBeLessThanOrEqual(40));
  });

  test('normalizeEntry - tags não-array vira array vazio', () => {
    const raw = { date: '2025-01-15', price: 65000, fiat: 100, tags: 'dca,hodl' };
    const n = normalizeEntry(raw);
    expect(n.tags).toEqual([]);
  });

  test('sanitizeImportPayload - array and object', () => {
    const payloadArray = [{ date: '2025-01-01', price: 60000, fiat: 50 }];
    const r1 = sanitizeImportPayload(payloadArray);
    expect(r1.ok).toBe(true);
    expect(r1.entries.length).toBe(1);
    expect(r1.sources).toHaveLength(1);

    const payloadObj = { vs: 'eur', year: 2025, entries: payloadArray };
    const r2 = sanitizeImportPayload(payloadObj);
    expect(r2.ok).toBe(true);
    expect(r2.vs).toBe('eur');
    expect(r2.year).toBe(2025);
    expect(r2.sources).toHaveLength(1);

    const payloadTxs = { txs: payloadArray, vs: 'USD' };
    const r3 = sanitizeImportPayload(payloadTxs);
    expect(r3.ok).toBe(true);
    expect(r3.entries.length).toBe(1);
    expect(r3.vs).toBe('usd');
    expect(r3.sources[0]).toEqual(payloadArray[0]);
  });
});
