import { validateTransaction, normalizeEntry, sanitizeImportPayload } from '../js/core/validators.js';

describe('core/validators', () => {
  test('validateTransaction aceita payload válido', () => {
    const result = validateTransaction({
      date: '2025-02-02',
      sats: 10_000,
      price: 25000,
      fiat: 100,
      fee: 0
    });
    expect(result.ok).toBe(true);
  });

  test('validateTransaction retorna erro para valores inválidos', () => {
    const result = validateTransaction({ date: null, sats: -1, price: 0, fiat: 0 });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('normalizeEntry e sanitizeImportPayload são propagados', () => {
    const entry = normalizeEntry({ date: '2025-03-01', price: 30000, fiat: 150 });
    expect(entry).not.toBeNull();
    const payload = sanitizeImportPayload([entry]);
    expect(payload.ok).toBe(true);
    expect(payload.entries).toHaveLength(1);
  });
});
