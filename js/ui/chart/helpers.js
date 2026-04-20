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
