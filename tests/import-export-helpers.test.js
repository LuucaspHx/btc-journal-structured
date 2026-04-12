import { csvEscape, normalizeImportShape, prepareImportPayloadFromText } from '../js/ui/import-export/helpers.js';

describe('csvEscape', () => {
  test('valor simples passa sem alteração', () => {
    expect(csvEscape('bitcoin')).toBe('bitcoin');
    expect(csvEscape(123)).toBe('123');
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });

  test('valor com vírgula ou aspas recebe quoting', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('linha1\nlinha2')).toBe('"linha1\nlinha2"');
  });

  test('proteção CSV injection — prefixo = força quoting', () => {
    expect(csvEscape('=SUM(A1:A10)')).toBe('"=SUM(A1:A10)"');
  });

  test('proteção CSV injection — prefixo + força quoting', () => {
    expect(csvEscape('+cmd|calc')).toBe('"+cmd|calc"');
  });

  test('proteção CSV injection — prefixo - força quoting', () => {
    expect(csvEscape('-2+3')).toBe('"-2+3"');
  });

  test('proteção CSV injection — prefixo @ força quoting', () => {
    expect(csvEscape('@SUM(1+1)')).toBe('"@SUM(1+1)"');
  });

  test('número negativo legítimo recebe quoting', () => {
    // valor numérico convertido para string começa com "-"
    expect(csvEscape(-50)).toBe('"-50"');
  });
});

describe('normalizeImportShape', () => {
  test('retorna null para entrada inválida', () => {
    expect(normalizeImportShape(null)).toBeNull();
    expect(normalizeImportShape({ foo: 'bar' })).toBeNull();
  });

  test('aceita array direto', () => {
    const result = normalizeImportShape([{ date: '2025-01-01' }]);
    expect(result.entries).toHaveLength(1);
    expect(result.goals).toBeUndefined();
  });

  test('extrai entries de objeto com chave entries', () => {
    const result = normalizeImportShape({ entries: [{ date: '2025-01-01' }], vs: 'brl' });
    expect(result.entries).toHaveLength(1);
    expect(result.meta.vs).toBe('brl');
  });

  test('extrai entries de objeto com chave txs', () => {
    const result = normalizeImportShape({ txs: [{ date: '2025-01-01' }] });
    expect(result.entries).toHaveLength(1);
  });

  test('extrai goals quando presente', () => {
    const goals = { list: [] };
    const result = normalizeImportShape({ entries: [], goals });
    expect(result.goals).toBe(goals);
  });
});
