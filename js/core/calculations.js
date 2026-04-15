const SATS_PER_BTC = 1e8;

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function extractSats(entry = {}) {
  if (!entry) return 0;
  if (Number.isFinite(entry.sats)) return Number(entry.sats);
  if (Number.isFinite(entry.btcAmount)) return Math.floor(entry.btcAmount * SATS_PER_BTC);
  if (Number.isFinite(entry.amountBtc)) return Math.floor(entry.amountBtc * SATS_PER_BTC);
  return 0;
}

function extractFiat(entry = {}) {
  if (!entry) return 0;
  if (Number.isFinite(entry.fiatAmount)) return Number(entry.fiatAmount);
  if (Number.isFinite(entry.fiat)) return Number(entry.fiat);
  const price = Number(entry.price ?? entry.btcPrice);
  const sats = extractSats(entry);
  if (Number.isFinite(price) && price > 0 && sats > 0) {
    const btc = satsToBtc(sats);
    return price * btc;
  }
  return 0;
}

export function satsFrom(fiatAmount = 0, btcPrice = 0, options = {}) {
  const fiat = toNumber(fiatAmount, 0);
  const price = toNumber(btcPrice, 0);
  const fee = toNumber(options.fee ?? options.fees ?? 0, 0);
  if (price <= 0 || fiat <= 0) return 0;
  const btc = (fiat - Math.max(0, fee)) / price;
  if (!Number.isFinite(btc) || btc <= 0) return 0;
  return Math.floor(btc * SATS_PER_BTC);
}

export function satsToBtc(sats = 0) {
  const value = Number(sats);
  if (!Number.isFinite(value) || value === 0) return 0;
  return value / SATS_PER_BTC;
}

export function pmMedio(entries = []) {
  if (!Array.isArray(entries) || entries.length === 0) return 0;
  let totalFiat = 0;
  let totalBtc = 0;
  for (const entry of entries) {
    const sats = extractSats(entry);
    if (sats <= 0) continue;
    const fiat = extractFiat(entry);
    const fee = toNumber(entry?.fee, 0);
    totalFiat += Math.max(0, fiat) + Math.max(0, fee);
    totalBtc += satsToBtc(sats);
  }
  if (totalBtc <= 0 || totalFiat <= 0) return 0;
  return totalFiat / totalBtc;
}

export function calcEntryPnL(entry, currentPrice) {
  const sats = extractSats(entry);
  const fiat = extractFiat(entry);
  const price = toNumber(currentPrice, 0);
  const currentValue = (sats / SATS_PER_BTC) * price;
  if (sats === 0 && fiat === 0) {
    return { currentValue: 0, pnlValue: 0, pnlPct: 0, isProfit: false };
  }
  const pnlValue = currentValue - fiat;
  const pnlPct = fiat > 0 ? (pnlValue / fiat) * 100 : null;
  return {
    currentValue,
    pnlValue,
    pnlPct,
    isProfit: pnlValue > 0,
  };
}

export const __test__ = {
  toNumber,
  extractSats,
  extractFiat,
};
