const SATS_PER_BTC = 1e8;

function getEntrySats(entry = {}) {
  if (Number.isFinite(entry?.sats)) return Number(entry.sats);
  if (Number.isFinite(entry?.btcAmount)) {
    return Math.floor(Number(entry.btcAmount) * SATS_PER_BTC);
  }
  return 0;
}

function getEntryFiat(entry = {}) {
  if (Number.isFinite(entry?.fiatAmount)) return Number(entry.fiatAmount);
  if (Number.isFinite(entry?.fiat)) return Number(entry.fiat);
  const price = Number(entry?.btcPrice ?? entry?.price ?? 0);
  const sats = getEntrySats(entry);
  if (price > 0 && sats > 0) return (sats / SATS_PER_BTC) * price;
  return price;
}

export function computePortfolioSummary(entries = [], currentPrice = null) {
  const source = Array.isArray(entries) ? entries : [];
  const openPositions = source.filter((entry) => !entry?.closed);
  const totalSats = openPositions.reduce((total, entry) => total + getEntrySats(entry), 0);
  const investedFiat = openPositions.reduce((total, entry) => {
    const fiat = getEntryFiat(entry);
    const fee = Number(entry?.fee);
    return total + (Number.isFinite(fiat) ? fiat : 0) + (Number.isFinite(fee) ? fee : 0);
  }, 0);
  const btcAmount = totalSats / SATS_PER_BTC;
  const hasHoldings = btcAmount > 0;
  const averagePrice = hasHoldings ? investedFiat / btcAmount : 0;
  const currentValue =
    currentPrice && hasHoldings ? currentPrice * btcAmount : hasHoldings ? null : 0;
  const pnlValue =
    currentValue != null && hasHoldings ? currentValue - investedFiat : hasHoldings ? null : 0;
  const pnlPercent =
    pnlValue != null && hasHoldings && investedFiat > 0
      ? (pnlValue / investedFiat) * 100
      : hasHoldings
        ? null
        : 0;

  return {
    entryCount: source.length,
    openPositionCount: openPositions.length,
    hasOpenPositions: openPositions.length > 0,
    hasHoldings,
    totalSats,
    btcAmount,
    investedFiat,
    averagePrice,
    currentPrice,
    currentValue,
    pnlValue,
    pnlPercent,
  };
}
