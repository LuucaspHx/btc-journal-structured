const { normalizeEntry, sanitizeImportPayload, asNumber, asDateString, satsFrom } = require('../js/import-sanitizer');

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

  test('sanitizeImportPayload - array and object', () => {
    const payloadArray = [{ date: '2025-01-01', price: 60000, fiat: 50 }];
    const r1 = sanitizeImportPayload(payloadArray);
    expect(r1.ok).toBe(true);
    expect(r1.entries.length).toBe(1);

    const payloadObj = { vs: 'eur', year: 2025, entries: payloadArray };
    const r2 = sanitizeImportPayload(payloadObj);
    expect(r2.ok).toBe(true);
    expect(r2.vs).toBe('eur');
    expect(r2.year).toBe(2025);
  });
});
