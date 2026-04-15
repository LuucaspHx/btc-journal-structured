import { satsFrom, satsToBtc, pmMedio, calcEntryPnL } from '../js/core/calculations.js';

describe('core/calculations', () => {
  test('satsFrom calcula sats líquidos considerando fee', () => {
    const sats = satsFrom(1000, 20000, { fee: 10 });
    expect(sats).toBe(Math.floor(((1000 - 10) / 20000) * 1e8));
  });

  test('satsToBtc converte valores inteiros corretamente', () => {
    expect(satsToBtc(1e8)).toBe(1);
    expect(satsToBtc(5e7)).toBe(0.5);
  });

  test('pmMedio usa fiat + fee dividido por BTC acumulado', () => {
    const entries = [
      { fiatAmount: 1000, fee: 10, sats: 2e7 },
      { fiatAmount: 500, fee: 5, sats: 1e7 }
    ];
    const avg = pmMedio(entries);
    const totalFiat = (1000 + 10) + (500 + 5);
    const totalBtc = (2e7 + 1e7) / 1e8;
    expect(avg).toBeCloseTo(totalFiat / totalBtc);
  });
});

describe('calcEntryPnL', () => {
  test('retorna isProfit true quando valor atual > custo', () => {
    const entry = { sats: 100000, fiatAmount: 80 };
    const result = calcEntryPnL(entry, 100000);
    // valor atual = (100000/1e8) * 100000 = 100
    expect(result.currentValue).toBeCloseTo(100);
    expect(result.pnlValue).toBeCloseTo(20);
    expect(result.pnlPct).toBeCloseTo(25);
    expect(result.isProfit).toBe(true);
  });

  test('retorna isProfit false quando valor atual < custo', () => {
    const entry = { sats: 100000, fiatAmount: 80 };
    const result = calcEntryPnL(entry, 60000);
    expect(result.currentValue).toBeCloseTo(60);
    expect(result.pnlValue).toBeCloseTo(-20);
    expect(result.pnlPct).toBeCloseTo(-25);
    expect(result.isProfit).toBe(false);
  });

  test('funciona com shape híbrido fiat (sem fiatAmount)', () => {
    const entry = { sats: 100000, fiat: 80 };
    const result = calcEntryPnL(entry, 100000);
    expect(result.pnlValue).toBeCloseTo(20);
  });

  test('funciona com shape híbrido btcAmount (sem sats)', () => {
    const entry = { btcAmount: 0.001, fiatAmount: 80 };
    const result = calcEntryPnL(entry, 100000);
    expect(result.currentValue).toBeCloseTo(100);
  });

  test('retorna zeros quando currentPrice é 0', () => {
    const entry = { sats: 100000, fiatAmount: 80 };
    const result = calcEntryPnL(entry, 0);
    expect(result.currentValue).toBe(0);
    expect(result.pnlValue).toBeCloseTo(-80);
    expect(result.isProfit).toBe(false);
  });

  test('retorna zeros quando fiat derivado é 0', () => {
    const entry = { sats: 0, fiatAmount: 0 };
    const result = calcEntryPnL(entry, 100000);
    expect(result.currentValue).toBe(0);
    expect(result.pnlValue).toBe(0);
    expect(result.pnlPct).toBe(0);
  });
});
