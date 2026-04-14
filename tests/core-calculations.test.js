import { satsFrom, satsToBtc, pmMedio } from '../js/core/calculations.js';

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
