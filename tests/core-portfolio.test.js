import { computePortfolioSummary } from '../js/core/portfolio.js';

describe('computePortfolioSummary', () => {
  test('agrega sats, fiat e fees e ignora posicoes fechadas', () => {
    const result = computePortfolioSummary(
      [
        { sats: 10_000_000, fiatAmount: 2_000, fee: 10 },
        { btcAmount: 0.05, fiat: 1_000, fee: 5 },
        { sats: 5_000_000, fiatAmount: 700, fee: 7, closed: true },
      ],
      30_000
    );

    expect(result).toMatchObject({
      entryCount: 3,
      openPositionCount: 2,
      hasOpenPositions: true,
      hasHoldings: true,
      totalSats: 15_000_000,
      btcAmount: 0.15,
      investedFiat: 3_015,
      averagePrice: 20_100,
      currentPrice: 30_000,
      currentValue: 4_500,
      pnlValue: 1_485,
    });
    expect(result.pnlPercent).toBeCloseTo(49.2537313433);
  });

  test.each([
    [120_000, 20, 20],
    [80_000, -20, -20],
    [100_000, 0, 0],
  ])(
    'calcula P&L para preco %s',
    (currentPrice, expectedValue, expectedPercent) => {
      const result = computePortfolioSummary(
        [{ sats: 100_000, fiatAmount: 100, fee: 0 }],
        currentPrice
      );

      expect(result.pnlValue).toBeCloseTo(expectedValue);
      expect(result.pnlPercent).toBeCloseTo(expectedPercent);
    }
  );

  test('preserva valor atual e P&L indisponiveis sem preco de mercado', () => {
    const result = computePortfolioSummary([{ sats: 100_000, fiatAmount: 80, fee: 2 }]);

    expect(result.currentValue).toBeNull();
    expect(result.pnlValue).toBeNull();
    expect(result.pnlPercent).toBeNull();
    expect(result.averagePrice).toBe(82_000);
  });

  test('preserva o contrato agregado atual: fee integra o custo do P&L', () => {
    const result = computePortfolioSummary(
      [{ sats: 100_000, fiatAmount: 80, fee: 2 }],
      100_000
    );

    expect(result.investedFiat).toBe(82);
    expect(result.currentValue).toBeCloseTo(100);
    expect(result.pnlValue).toBeCloseTo(18);
    expect(result.pnlPercent).toBeCloseTo((18 / 82) * 100);
  });

  test('preserva fee negativa como reducao do custo agregado', () => {
    const result = computePortfolioSummary(
      [{ sats: 100_000, fiatAmount: 80, fee: -2 }],
      100_000
    );

    expect(result.investedFiat).toBe(78);
    expect(result.pnlValue).toBeCloseTo(22);
  });

  test('retorna o contrato vazio e o fallback de posicao aberta sem sats', () => {
    expect(computePortfolioSummary([])).toEqual({
      entryCount: 0,
      openPositionCount: 0,
      hasOpenPositions: false,
      hasHoldings: false,
      totalSats: 0,
      btcAmount: 0,
      investedFiat: 0,
      averagePrice: 0,
      currentPrice: null,
      currentValue: 0,
      pnlValue: 0,
      pnlPercent: 0,
    });

    const zeroHolding = computePortfolioSummary(
      [{ sats: 0, fiatAmount: 0, fee: 0 }],
      30_000
    );
    expect(zeroHolding.hasOpenPositions).toBe(true);
    expect(zeroHolding.hasHoldings).toBe(false);
    expect(zeroHolding.currentValue).toBe(0);
  });

  test('o consumidor controla portfolio completo versus subconjunto filtrado', () => {
    const entries = [
      { sats: 100_000, fiatAmount: 80 },
      { sats: 200_000, fiatAmount: 140 },
    ];

    expect(computePortfolioSummary(entries, 100_000).totalSats).toBe(300_000);
    expect(computePortfolioSummary(entries.slice(0, 1), 100_000).totalSats).toBe(100_000);
  });

  test('aplica floor por entrada em 64 microaportes btcAmount sem drift nos sats', () => {
    const entries = Array.from({ length: 64 }, () => ({
      btcAmount: 1_001.9 / 1e8,
      fiatAmount: 0.37,
      fee: 0.01,
    }));
    const result = computePortfolioSummary(entries, 75_000);

    expect(result.totalSats).toBe(64_064);
    expect(result.btcAmount).toBe(0.00064064);
    expect(result.investedFiat).toBeCloseTo(24.32, 12);
    expect(result.currentValue).toBeCloseTo(48.048, 12);
  });
});
