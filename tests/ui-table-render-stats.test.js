import { renderStats } from '../js/ui/table/render.js';

function createElement(id = '') {
  return {
    id,
    textContent: '',
    className: '',
    style: {},
    children: [],
    appendChild(child) {
      this.children.push(child);
      if (child.id) document.__elements.set(child.id, child);
    },
  };
}

function installStatsDocument() {
  const elements = new Map();
  elements.set('stats', createElement('stats'));
  ['kpiInvested', 'kpiSats', 'kpiAvg', 'kpiCurrent', 'kpiPL', 'kpiPLPct'].forEach((id) => {
    elements.set(id, createElement(id));
  });

  global.document = {
    __elements: elements,
    getElementById: (id) => elements.get(id) || null,
    createElement: () => createElement(),
  };

  return elements;
}

function render(list, { currentPrice = null, totalCount = list.length } = {}) {
  const elements = installStatsDocument();
  renderStats({
    list,
    totalCount,
    getLatestMarketPrice: () => currentPrice,
    currentFiatCurrency: () => 'USD',
    fmtCurrency: (value) => `USD ${Number(value).toFixed(2)}`,
    fmtSignedCurrency: (value) =>
      `${Number(value) > 0 ? '+' : Number(value) < 0 ? '-' : ''}USD ${Math.abs(Number(value)).toFixed(2)}`,
    fmtPercent: (value) => `${Number(value).toFixed(2)}%`,
    fmtInt: (value) => String(value),
  });
  return elements;
}

afterEach(() => {
  delete global.document;
});

describe('renderStats characterization', () => {
  test('preserva o agregado atual, incluindo fees e exclusao de posicoes fechadas', () => {
    const entries = [
      { sats: 10_000_000, fiatAmount: 2_000, fee: 10 },
      { btcAmount: 0.05, fiat: 1_000, fee: 5 },
      { sats: 5_000_000, fiatAmount: 700, fee: 7, closed: true },
    ];

    const elements = render(entries, { currentPrice: 30_000, totalCount: 4 });

    expect(elements.get('kpiInvested').textContent).toBe('USD 3015.00');
    expect(elements.get('kpiSats').textContent).toBe('15000000');
    expect(elements.get('kpiAvg').textContent).toBe('USD 20100.00');
    expect(elements.get('kpiCurrent').textContent).toBe('USD 4500.00');
    expect(elements.get('kpiPL').textContent).toBe('+USD 1485.00');
    expect(elements.get('kpiPLPct').textContent).toBe('49.25%');
    expect(elements.get('statsMeta').textContent).toBe(
      'Mostrando 3 de 4 aportes (filtros ativos).'
    );
  });

  test('mantem valor atual e P&L indisponiveis quando nao ha preco de mercado', () => {
    const elements = render([{ sats: 100_000, fiatAmount: 80, fee: 2 }]);

    expect(elements.get('kpiInvested').textContent).toBe('USD 82.00');
    expect(elements.get('kpiAvg').textContent).toBe('USD 82000.00');
    expect(elements.get('kpiCurrent').textContent).toBe('—');
    expect(elements.get('kpiPL').textContent).toBe('—');
    expect(elements.get('kpiPLPct').textContent).toBe('—');
  });

  test('preserva os fallbacks da carteira vazia e da posicao sem sats', () => {
    const empty = render([]);
    expect(empty.get('kpiInvested').textContent).toBe('—');
    expect(empty.get('kpiSats').textContent).toBe('0');
    expect(empty.get('kpiAvg').textContent).toBe('—');
    expect(empty.get('kpiCurrent').textContent).toBe('—');
    expect(empty.get('kpiPL').textContent).toBe('—');
    expect(empty.get('kpiPLPct').textContent).toBe('—');

    const zeroHolding = render([{ sats: 0, fiatAmount: 0, fee: 0 }], {
      currentPrice: 30_000,
    });
    expect(zeroHolding.get('kpiInvested').textContent).toBe('USD 0.00');
    expect(zeroHolding.get('kpiAvg').textContent).toBe('USD 0.00');
    expect(zeroHolding.get('kpiCurrent').textContent).toBe('USD 0.00');
    expect(zeroHolding.get('kpiPL').textContent).toBe('USD 0.00');
    expect(zeroHolding.get('kpiPLPct').textContent).toBe('0.00%');
  });
});
