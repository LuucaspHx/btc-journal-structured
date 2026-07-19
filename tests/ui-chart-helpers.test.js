import { buildPinDataset, buildPinModalData } from '../js/ui/chart/helpers.js';

describe('ui/chart/helpers', () => {
  const tx = {
    id: 'tx1',
    date: '2025-01-15',
    sats: 150000,
    fiatAmount: 80,
    btcPrice: 82000
  };

  test('buildPinDataset retorna array de pontos com x e y corretos', () => {
    const points = buildPinDataset([tx]);
    expect(points).toHaveLength(1);
    expect(points[0].x).toBe('2025-01-15');
    expect(points[0].y).toBe(82000);
    expect(points[0].txId).toBe('tx1');
  });

  test('buildPinDataset ignora entradas sem date ou btcPrice', () => {
    const bad = { id: 'x', sats: 100 };
    const points = buildPinDataset([tx, bad]);
    expect(points).toHaveLength(1);
  });

  test('buildPinModalData retorna os campos essenciais', () => {
    const modal = buildPinModalData(tx, 100000);
    expect(modal.date).toBe('2025-01-15');
    expect(modal.sats).toBe(150000);
    expect(modal.costFiat).toBe(80);
    expect(modal.currentValue).toBeCloseTo(150);
    expect(modal.isProfit).toBe(true);
  });
});
