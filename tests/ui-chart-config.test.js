import { buildChartConfig } from '../js/ui/chart/config.js';

describe('ui/chart/config', () => {
  const tokens = {
    accent: () => 'accent',
    bgPage: () => 'page',
    bgSurface: () => 'surface',
    chartGrid: () => 'grid',
    danger: () => 'danger',
    ok: () => 'ok',
    textMuted: () => 'muted',
    warn: () => 'warn',
  };
  const formatCurrency = (value, currency) => `${currency}:${value}`;
  const base = {
    series: {
      labels: [1, 2],
      priceData: [70_000, 72_000],
      points: [{ x: 1, y: 70_000, sats: 100_000 }],
      avgPrice: 71_000,
    },
    range: { min: 1, max: 2 },
    tokens,
    formatCurrency,
    formatInt: String,
    formatPercent: String,
    crosshairPlugin: { id: 'crosshair' },
  };

  test('builds price, entry and average datasets without annotations', () => {
    const config = buildChartConfig({ ...base, addAverageDataset: true });

    expect(config.data.datasets.map((dataset) => dataset.label)).toEqual([
      'BTC/USD',
      'Entradas',
      'Preço médio',
    ]);
    expect(config.plugins).toEqual([{ id: 'crosshair' }]);
  });

  test('builds OHLC and annotations from explicit runtime inputs', () => {
    const config = buildChartConfig({
      ...base,
      includeCandles: true,
      ohlc: [{ t: 1, o: 10, h: 12, l: 9, c: 11 }],
      useAnnotation: true,
      targetPriceUsd: 80_000,
    });

    expect(config.data.datasets[0]).toMatchObject({
      label: 'OHLC',
      type: 'candlestick',
      data: [{ x: 1, o: 10, h: 12, l: 9, c: 11 }],
    });
    expect(config.options.plugins.annotation.annotations).toHaveProperty('avgLine');
    expect(config.options.plugins.annotation.annotations).toHaveProperty('targetPrice');
  });

  test('does not expose the USD target annotation in another currency', () => {
    const config = buildChartConfig({
      ...base,
      vsLabel: 'EUR',
      useAnnotation: true,
      targetPriceUsd: 80_000,
    });

    expect(config.data.datasets).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: 'BTC/EUR' })])
    );
    expect(config.options.plugins.annotation.annotations).not.toHaveProperty('targetPrice');
  });
});
