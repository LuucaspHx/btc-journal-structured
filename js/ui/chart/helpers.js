import { calcEntryPnL } from '../../core/calculations.js';
import { getTxPrice, getTxSats, getTxFiat, getTxDate } from '../table/helpers.js';

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
