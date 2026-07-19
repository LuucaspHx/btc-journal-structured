import { calcEntryPnL } from '../../core/calculations.js';
import { getTxPrice, getTxSats, getTxFiat, getTxDate } from '../table/helpers.js';

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
