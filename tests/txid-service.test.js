import { validateTxidEntry, buildExplorerUrl, resolveNetwork, TXID_STATUS } from '../js/services/txid-service.js';

const mockEntry = (overrides = {}) => ({
  id: 'tx1',
  txid: 'abc123ff00',
  date: '2025-01-01',
  sats: 200000,
  wallet: 'bc1qtestaddress',
  price: 20000,
  fiat: 40,
  ...overrides
});

const explorerPayload = ({ confirmed = true, block_height = 840000, outputs = [], time = 1710000000 } = {}) => ({
  txid: 'abc123ff00',
  status: {
    confirmed,
    block_height,
    block_time: time
  },
  vout: outputs.length ? outputs : [
    { value: 200000, scriptpubkey_address: 'bc1qtestaddress' }
  ]
});

describe('txid-service', () => {
  test('validateTxidEntry returns manual when txid missing', async () => {
    const result = await validateTxidEntry({ sats: 10 });
    expect(result.status).toBe(TXID_STATUS.MANUAL);
  });

  test('returns invalid when explorer responds 404', async () => {
    const fetcher = async () => ({ ok: false, status: 404 });
    const result = await validateTxidEntry(mockEntry(), { fetcher });
    expect(result.status).toBe(TXID_STATUS.INVALID);
  });

  test('pending when transaction not yet confirmed', async () => {
    const fetcher = async () => ({ ok: true, json: async () => explorerPayload({ confirmed: false }) });
    const result = await validateTxidEntry(mockEntry(), { fetcher });
    expect(result.status).toBe(TXID_STATUS.PENDING);
  });

  test('confirmed when amount and wallet match', async () => {
    const fetcher = async () => ({ ok: true, json: async () => explorerPayload() });
    const result = await validateTxidEntry(mockEntry(), { fetcher });
    expect(result.status).toBe(TXID_STATUS.CONFIRMED);
    expect(result.confirmations).toBeGreaterThan(0);
  });

  test('mismatch when wallet provided but output not found', async () => {
    const fetcher = async () => ({ ok: true, json: async () => explorerPayload({ outputs: [{ value: 200000, scriptpubkey_address: 'bc1qdifferent' }] }) });
    const result = await validateTxidEntry(mockEntry(), { fetcher });
    expect(result.status).toBe(TXID_STATUS.MISMATCH);
  });

  test('inconclusive when explorer fails unexpectedly', async () => {
    const fetcher = async () => { throw new Error('network down'); };
    const result = await validateTxidEntry(mockEntry(), { fetcher });
    expect(result.status).toBe(TXID_STATUS.INCONCLUSIVE);
    expect(result.reason).toMatch(/network down/i);
  });

  test('buildExplorerUrl respects network prefix', () => {
    const main = buildExplorerUrl('abc', { network: 'mainnet' });
    expect(main).toContain('/tx/abc');
    const testnet = buildExplorerUrl('abc', { network: 'testnet' });
    expect(testnet).toContain('/testnet/tx/abc');
  });

  test('resolveNetwork infers from string', () => {
    expect(resolveNetwork('bitcoin')).toBe('mainnet');
    expect(resolveNetwork('TB1-test')).toBe('testnet');
  });

  test('retorna confirmedAt em formato YYYY-MM-DD quando confirmado', async () => {
    const fetcher = async () => ({
      ok: true,
      json: async () => explorerPayload({ confirmed: true, time: 1710000000 })
    });
    const result = await validateTxidEntry(mockEntry(), { fetcher });
    // 1710000000 * 1000 = Date → '2024-03-09'
    expect(result.confirmedAt).toBe('2024-03-09');
  });

  test('confirmedAt é null quando não confirmado', async () => {
    const fetcher = async () => ({
      ok: true,
      json: async () => explorerPayload({ confirmed: false })
    });
    const result = await validateTxidEntry(mockEntry(), { fetcher });
    expect(result.confirmedAt).toBeNull();
  });
});
