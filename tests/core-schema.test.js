import { createDefaultEntry, SCHEMA_VERSION } from '../js/core/schema.js';

describe('core/schema', () => {
  test('createDefaultEntry aplica defaults e preserva schema', () => {
    const entry = createDefaultEntry({
      id: 'tx-1',
      date: '2025-01-01',
      fiatAmount: 1000,
      btcPrice: 25000,
      sats: 4e7,
      note: 'teste',
      tags: ['long-term', 'stack']
    });
    expect(entry.schemaVersion).toBe(SCHEMA_VERSION);
    expect(entry.id).toBe('tx-1');
    expect(entry.sats).toBe(4e7);
    expect(entry.btcAmount).toBeCloseTo(0.4);
    expect(entry.note).toBe('teste');
    expect(entry.tags).toEqual(['long-term', 'stack']);
  });

  test('preenche campos vazios com valores padrão', () => {
    const entry = createDefaultEntry({});
    expect(entry.id).toBeTruthy();
    expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(entry.fiatCurrency).toBe('USD');
    expect(entry.type).toBe('buy');
    expect(entry.tags).toEqual([]);
  });

  test('normaliza estratégia e tags duplicadas', () => {
    const entry = createDefaultEntry({
      strategy: '  DCA  ',
      tags: 'cold,long-term,COLD,stack,stack'
    });
    expect(entry.strategy).toBe('DCA');
    expect(entry.tags).toEqual(['cold', 'long-term', 'stack']);
  });
});
