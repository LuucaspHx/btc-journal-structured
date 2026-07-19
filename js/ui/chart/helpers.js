import { calcEntryPnL } from '../../core/calculations.js';
import { getTxPrice, getTxSats, getTxFiat, getTxDate, getTxNote } from '../table/helpers.js';

export const MIN_POINT_RADIUS = 3;
export const MAX_POINT_RADIUS = 10;

export function computePointRadius(sats = 0) {
  if (!Number.isFinite(sats) || sats <= 0) return MIN_POINT_RADIUS;
  const magnitude = Math.log10(Math.max(1, sats));
  return Math.min(MAX_POINT_RADIUS, Math.max(MIN_POINT_RADIUS, 3 + magnitude * 0.6));
}

export function sanitizeChartDataset(dataset = {}) {
  const next = { ...dataset };
  const originalData = Array.isArray(dataset.data) ? dataset.data : [];

  if (next.type === 'candlestick') {
    next.data = originalData.filter(isValidCandlestickPoint);
    return next;
  }

  if (next.type === 'scatter') {
    next.data = originalData.filter(isValidScatterChartPoint);
    if (!Number.isFinite(next.pointHitRadius)) next.pointHitRadius = MAX_POINT_RADIUS + 6;
    return next;
  }

  next.data = originalData.filter(isValidLineChartPoint);
  if (!Number.isFinite(next.pointHitRadius)) next.pointHitRadius = 8;
  return next;
}

export function sanitizeChartConfig(cfg) {
  const datasets = Array.isArray(cfg?.data?.datasets) ? cfg.data.datasets : [];
  const sanitizedDatasets = datasets
    .map((dataset) => sanitizeChartDataset(dataset))
    .filter((dataset) => Array.isArray(dataset.data) && dataset.data.length > 0);
  return {
    ...cfg,
    data: {
      ...(cfg?.data || {}),
      datasets: sanitizedDatasets,
    },
  };
}

export function getPrimaryPriceDataset(cfg) {
  const datasets = Array.isArray(cfg?.data?.datasets) ? cfg.data.datasets : [];
  return (
    datasets.find(
      (dataset) =>
        dataset?.type !== 'scatter' &&
        dataset?.type !== 'candlestick' &&
        typeof dataset?.label === 'string' &&
        dataset.label.startsWith('BTC/')
    ) || null
  );
}

export function buildChartEntryPoint(tx, currentPrice) {
  const dateStr = getTxDate(tx);
  const time = dateStr ? new Date(dateStr).getTime() : Number.NaN;
  if (Number.isNaN(time)) return null;

  const price = getTxPrice(tx);
  if (!Number.isFinite(price) || price <= 0) return null;

  const sats = getTxSats(tx);
  const plPct = currentPrice && price ? ((currentPrice - price) / price) * 100 : 0;
  const type = typeof tx.type === 'string' ? tx.type.toLowerCase() : 'buy';
  return {
    x: time,
    y: price,
    sats,
    note: getTxNote(tx),
    exchange: tx.exchange || '',
    type,
    closed: Boolean(tx.closed),
    fiat: getTxFiat(tx),
    plPct,
    id: tx.id,
  };
}

export function buildEntryDataset(points = [], tokens) {
  return {
    type: 'scatter',
    label: 'Entradas',
    data: points,
    parsing: false,
    pointRadius(context) {
      return computePointRadius(context.raw?.sats || 0);
    },
    pointHoverRadius(context) {
      return Math.min(MAX_POINT_RADIUS + 2, computePointRadius(context.raw?.sats || 0) + 2);
    },
    pointHitRadius(context) {
      return Math.min(MAX_POINT_RADIUS + 6, computePointRadius(context.raw?.sats || 0) + 6);
    },
    pointBackgroundColor(context) {
      const raw = context.raw || {};
      if (raw.closed) return tokens.textMuted();
      if (raw.type === 'sell') return tokens.warn();
      if (raw.plPct > 0) return tokens.ok();
      if (raw.plPct < 0) return tokens.danger();
      return tokens.warn();
    },
    pointBorderColor(context) {
      const raw = context.raw || {};
      if (raw.closed) return tokens.textMuted();
      return tokens.bgPage();
    },
    pointBorderWidth: 1,
    pointStyle(context) {
      const raw = context.raw || {};
      if (raw.closed) return 'rectRounded';
      if (raw.type === 'sell') return 'triangle';
      return 'circle';
    },
    order: 10,
  };
}

export function buildAverageDataset(length = 0, avgPrice = 0, tokens) {
  return {
    label: 'Preço médio',
    type: 'line',
    data: Array.from({ length }, () => avgPrice),
    borderColor: tokens.warn(),
    borderDash: [6, 6],
    borderWidth: 1,
    pointRadius: 0,
    tension: 0,
    order: 2,
  };
}

export function buildChartOptions({
  range = {},
  vsLabel = 'USD',
  compact = false,
  formatCurrency,
  formatInt,
  formatPercent,
  tokens,
} = {}) {
  const formatCurrencyValue = (value) => formatCurrency(value, vsLabel);
  const tooltipTitle = (items) => {
    if (!items || !items.length) return '';
    const raw = items[0];
    const value = raw.parsed?.x ?? raw.label ?? raw.parsed;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('pt-BR', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'nearest',
      intersect: false,
      axis: 'x',
    },
    scales: {
      x: {
        type: 'time',
        time: { unit: 'month', displayFormats: { month: 'MMM yyyy' } },
        min: range.min,
        max: range.max,
        ticks: {
          color: tokens.textMuted(),
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: compact ? 6 : 12,
        },
        grid: { color: tokens.chartGrid() },
      },
      y: {
        ticks: { color: tokens.textMuted() },
        grid: { color: tokens.chartGrid() },
      },
    },
    plugins: {
      legend: { labels: { color: tokens.textMuted() } },
      btcJournalCrosshair: {
        color: tokens.textMuted(),
        dash: [4, 4],
        lineWidth: 1,
      },
      tooltip: {
        callbacks: {
          title: tooltipTitle,
          label(context) {
            const ds = context.dataset || {};
            if (ds.type === 'scatter') {
              const raw = context.raw || {};
              const lines = [];
              lines.push(`Preço: ${formatCurrencyValue(raw.y)}`);
              lines.push(`Sats: ${formatInt(raw.sats || 0)}`);
              if (raw.exchange) lines.push(`Exchange: ${raw.exchange}`);
              if (raw.type) lines.push(`Tipo: ${raw.type === 'sell' ? 'Venda' : 'Compra'}`);
              if (Number.isFinite(raw.plPct)) lines.push(`P/L atual: ${formatPercent(raw.plPct)}`);
              if (raw.note) lines.push(`Nota: ${raw.note}`);
              return lines;
            }
            const value = context.parsed?.y ?? context.formattedValue;
            return `${context.dataset.label}: ${formatCurrencyValue(value)}`;
          },
        },
      },
    },
  };
}

function isValidLineChartPoint(point) {
  if (Number.isFinite(point)) return true;
  return Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y));
}

function isValidScatterChartPoint(point) {
  return Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y));
}

function isValidCandlestickPoint(point) {
  return Boolean(
    point &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.o) &&
    Number.isFinite(point.h) &&
    Number.isFinite(point.l) &&
    Number.isFinite(point.c)
  );
}

export function buildPinDataset(txs = []) {
  return txs
    .filter((tx) => tx.date && getTxPrice(tx) > 0)
    .map((tx) => ({
      x: getTxDate(tx),
      y: getTxPrice(tx),
      txId: tx.id,
    }));
}

export function buildPinModalData(tx, currentPrice) {
  const pnl = calcEntryPnL(tx, currentPrice);
  return {
    date: getTxDate(tx),
    sats: getTxSats(tx),
    costFiat: getTxFiat(tx),
    currentValue: pnl.currentValue,
    pnlValue: pnl.pnlValue,
    pnlPct: pnl.pnlPct,
    isProfit: pnl.isProfit,
  };
}

export function buildTargetPriceAnnotation(
  valueUsd,
  { color, backgroundColor = 'transparent' } = {}
) {
  const value = Number(valueUsd);
  if (!Number.isFinite(value) || value <= 0) return null;

  return {
    type: 'line',
    scaleID: 'y',
    value,
    adjustScaleRange: false,
    borderColor: color,
    borderWidth: 1,
    borderDash: [6, 4],
    label: {
      display: true,
      content: `▸ $${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
      position: 'end',
      color,
      backgroundColor,
      padding: 4,
      font: { size: 11 },
    },
  };
}
