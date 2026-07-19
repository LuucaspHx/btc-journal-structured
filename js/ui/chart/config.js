import {
  buildAverageDataset,
  buildChartOptions,
  buildEntryDataset,
  buildTargetPriceAnnotation,
  sanitizeChartConfig,
} from './helpers.js';

export function buildChartConfig({
  series,
  ohlc = [],
  includeCandles = false,
  useAnnotation = false,
  addAverageDataset = false,
  compact = false,
  range = {},
  vsLabel = 'USD',
  targetPriceUsd = null,
  tokens,
  formatCurrency,
  formatInt,
  formatPercent,
  crosshairPlugin,
}) {
  const datasets = [];
  if (includeCandles && Array.isArray(ohlc) && ohlc.length > 0) {
    const candData = ohlc.map((item) => ({
      x: item.t,
      o: item.o,
      h: item.h,
      l: item.l,
      c: item.c,
    }));
    datasets.push({
      label: 'OHLC',
      type: 'candlestick',
      data: candData,
      color: { up: tokens.ok(), down: tokens.danger() },
      order: 0,
    });
  }

  const pricePoints = series.labels
    .map((time, index) => ({ x: time, y: series.priceData[index] }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  datasets.push({
    label: `BTC/${vsLabel}`,
    data: pricePoints,
    parsing: false,
    borderWidth: 1.5,
    borderColor: tokens.accent(),
    backgroundColor: 'transparent',
    pointRadius(context) {
      return context.active ? 3 : 0;
    },
    pointHoverRadius: 4,
    pointHitRadius: 10,
    pointBackgroundColor: tokens.accent(),
    pointBorderColor: tokens.bgSurface(),
    pointBorderWidth: 1,
    tension: 0.2,
    order: 1,
  });
  datasets.push(buildEntryDataset(series.points, tokens));

  const targetAnnotation =
    vsLabel === 'USD'
      ? buildTargetPriceAnnotation(targetPriceUsd, {
          color: tokens.warn(),
          backgroundColor: tokens.bgSurface(),
        })
      : null;
  if (!useAnnotation && addAverageDataset && series.avgPrice > 0) {
    datasets.push(buildAverageDataset(series.labels.length, series.avgPrice, tokens));
  }

  const config = {
    type: 'line',
    data: { labels: series.labels, datasets },
    options: buildChartOptions({
      range,
      vsLabel,
      compact,
      formatCurrency,
      formatInt,
      formatPercent,
      tokens,
    }),
    plugins: [crosshairPlugin],
  };

  if (useAnnotation && (series.avgPrice > 0 || targetAnnotation)) {
    const annotations = {};
    if (series.avgPrice > 0) {
      annotations.avgLine = {
        type: 'line',
        yMin: series.avgPrice,
        yMax: series.avgPrice,
        borderColor: tokens.warn(),
        borderWidth: 1,
        borderDash: [6, 6],
        label: {
          enabled: true,
          content: `PM ${formatCurrency(series.avgPrice, vsLabel)}`,
          position: 'end',
          backgroundColor: tokens.bgSurface(),
          color: tokens.warn(),
          padding: 4,
        },
      };
    }
    if (targetAnnotation) annotations.targetPrice = targetAnnotation;
    config.options.plugins.annotation = { annotations };
  }

  return sanitizeChartConfig(config);
}
