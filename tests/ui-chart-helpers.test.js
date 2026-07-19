import {
  buildPinDataset,
  buildPinModalData,
  buildTargetPriceAnnotation,
  buildAverageDataset,
  buildChartEntryPoint,
  buildChartOptions,
  buildEntryDataset,
  computePointRadius,
  getPrimaryPriceDataset,
  MAX_POINT_RADIUS,
  sanitizeChartConfig,
  sanitizeChartDataset,
} from '../js/ui/chart/helpers.js';

describe('ui/chart/helpers', () => {
  const tokens = {
    textMuted: () => 'muted',
    warn: () => 'warn',
    ok: () => 'ok',
    danger: () => 'danger',
    bgPage: () => 'page',
    chartGrid: () => 'grid',
  };
  const tx = {
    id: 'tx1',
    date: '2025-01-15',
    sats: 150000,
    fiatAmount: 80,
    btcPrice: 82000,
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

  test.each([null, 0, -1000, Number.NaN, Number.POSITIVE_INFINITY])(
    'buildTargetPriceAnnotation rejeita valor inválido: %s',
    (value) => {
      expect(buildTargetPriceAnnotation(value, { color: 'amber' })).toBeNull();
    }
  );

  test('buildTargetPriceAnnotation cria linha horizontal formatada', () => {
    const annotation = buildTargetPriceAnnotation(70000, { color: 'amber' });

    expect(annotation).toMatchObject({
      type: 'line',
      scaleID: 'y',
      value: 70000,
      adjustScaleRange: false,
      borderColor: 'amber',
      borderWidth: 1,
      borderDash: [6, 4],
      label: {
        display: true,
        content: '▸ $70,000',
        position: 'end',
        color: 'amber',
      },
    });
  });

  test('buildTargetPriceAnnotation limita o label a duas casas decimais', () => {
    const annotation = buildTargetPriceAnnotation(1000000.125, { color: 'amber' });

    expect(annotation.label.content).toBe('▸ $1,000,000.13');
  });

  test('computePointRadius mantém os limites do marcador', () => {
    expect(computePointRadius()).toBe(3);
    expect(computePointRadius(-1)).toBe(3);
    expect(computePointRadius(10 ** 20)).toBe(MAX_POINT_RADIUS);
  });

  test('buildChartEntryPoint preserva os dados usados pelo tooltip', () => {
    expect(buildChartEntryPoint(tx, 100000)).toMatchObject({
      y: 82000,
      sats: 150000,
      fiat: 80,
      plPct: expect.closeTo(21.9512, 4),
      id: 'tx1',
      type: 'buy',
    });
    expect(buildChartEntryPoint({ ...tx, date: '' }, 100000)).toBeNull();
  });

  test('buildEntryDataset preserva raio, cor e forma dos marcadores', () => {
    const dataset = buildEntryDataset([], tokens);

    expect(dataset.pointRadius({ raw: { sats: 150000 } })).toBeGreaterThan(3);
    expect(dataset.pointBackgroundColor({ raw: { plPct: 1 } })).toBe('ok');
    expect(dataset.pointBackgroundColor({ raw: { plPct: -1 } })).toBe('danger');
    expect(dataset.pointStyle({ raw: { type: 'sell' } })).toBe('triangle');
    expect(dataset.pointBorderColor({ raw: {} })).toBe('page');
  });

  test('buildAverageDataset mantém a linha média e a cor do tema', () => {
    expect(buildAverageDataset(3, 75000, tokens)).toMatchObject({
      type: 'line',
      data: [75000, 75000, 75000],
      borderColor: 'warn',
    });
  });

  test('buildChartOptions preserva escalas, tema e tooltips', () => {
    const options = buildChartOptions({
      range: { min: 10, max: 20 },
      vsLabel: 'EUR',
      compact: true,
      formatCurrency: (value, currency) => `${currency}:${value}`,
      formatInt: (value) => `int:${value}`,
      formatPercent: (value) => `pct:${value}`,
      tokens,
    });

    expect(options.scales.x).toMatchObject({ min: 10, max: 20 });
    expect(options.scales.x.ticks.maxTicksLimit).toBe(6);
    expect(options.plugins.legend.labels.color).toBe('muted');
    expect(
      options.plugins.tooltip.callbacks.label({
        dataset: { type: 'scatter' },
        raw: { y: 75000, sats: 123, type: 'sell', plPct: 2, note: 'teste' },
      })
    ).toEqual([
      'Preço: EUR:75000',
      'Sats: int:123',
      'Tipo: Venda',
      'P/L atual: pct:2',
      'Nota: teste',
    ]);
  });

  test('sanitizeChartDataset remove pontos inválidos por tipo', () => {
    expect(
      sanitizeChartDataset({
        type: 'scatter',
        data: [
          { x: 1, y: 2 },
          { x: 1, y: Number.NaN },
        ],
      })
    ).toMatchObject({ data: [{ x: 1, y: 2 }], pointHitRadius: MAX_POINT_RADIUS + 6 });

    expect(
      sanitizeChartDataset({
        type: 'candlestick',
        data: [
          { x: 1, o: 1, h: 2, l: 0, c: 1 },
          { x: 1, o: 1, h: 2, l: 0 },
        ],
      }).data
    ).toEqual([{ x: 1, o: 1, h: 2, l: 0, c: 1 }]);
  });

  test('sanitizeChartConfig descarta datasets sem pontos válidos', () => {
    const config = sanitizeChartConfig({
      data: {
        labels: [1],
        datasets: [
          { label: 'BTC/USD', data: [{ x: 1, y: 2 }] },
          { type: 'scatter', label: 'Entradas', data: [{ x: 1, y: Number.NaN }] },
        ],
      },
    });

    expect(config.data.datasets).toHaveLength(1);
    expect(getPrimaryPriceDataset(config).label).toBe('BTC/USD');
  });
});
