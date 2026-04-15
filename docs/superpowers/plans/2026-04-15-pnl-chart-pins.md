# P&L em Tempo Real + Alfinetes no Gráfico — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar P&L dinâmico por aporte na tabela e alfinetes clicáveis no gráfico de preço histórico, com preço BTC atualizado a cada 30s.

**Architecture:** Quatro camadas incrementais: (1) `price-service.js` centraliza o polling de preço; (2) `calcEntryPnL` em `calculations.js` computa P&L por aporte usando os extratores canônicos existentes; (3) coluna P&L na tabela com estilo financeiro; (4) módulo `js/ui/chart/` isolado com dataset de alfinetes, modal de detalhes e bind de clique. O `txid-service` é expandido para retornar `confirmedAt` (data on-chain).

**Tech Stack:** Vanilla JS (ES modules), Chart.js, Jest (NODE_OPTIONS=--experimental-vm-modules), CoinGecko API, mempool.space API.

---

## Mapa de Arquivos

| Arquivo | Ação |
|---|---|
| `js/services/price-service.js` | Criar |
| `js/core/calculations.js` | Expandir — adicionar `calcEntryPnL` |
| `js/services/txid-service.js` | Expandir — adicionar `confirmedAt` ao retorno |
| `js/ui/table/helpers.js` | Expandir — adicionar `formatPnL` e `formatCurrentValue` |
| `js/ui/table/render.js` | Expandir — adicionar coluna P&L |
| `js/ui/chart/helpers.js` | Criar |
| `js/ui/chart/render.js` | Criar |
| `js/ui/chart/bind.js` | Criar |
| `js/app.js` | Expandir — integrar price-service, chart module, confirmedAt |
| `css/style.css` | Expandir — estilos P&L e modal |
| `tests/core-calculations.test.js` | Expandir |
| `tests/txid-service.test.js` | Expandir |
| `tests/price-service.test.js` | Criar |
| `tests/ui-table-helpers.test.js` | Criar |
| `tests/ui-chart-helpers.test.js` | Criar |

---

## Task 1: calcEntryPnL em calculations.js

**Files:**
- Modify: `js/core/calculations.js`
- Modify: `tests/core-calculations.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao final de `tests/core-calculations.test.js`:

```js
import { satsFrom, satsToBtc, pmMedio, calcEntryPnL } from '../js/core/calculations.js';

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
    // valor atual = (100000/1e8) * 60000 = 60
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
    // sats = 0.001 * 1e8 = 100000, valor atual = 100
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
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```bash
cd /Users/lucas_phx/Documents/btc-journal-structured
NODE_OPTIONS=--experimental-vm-modules npx jest tests/core-calculations.test.js --no-coverage 2>&1 | tail -20
```

Esperado: FAIL — `calcEntryPnL is not a function`

- [ ] **Step 3: Implementar calcEntryPnL em calculations.js**

Adicionar após a função `pmMedio` (antes de `export const __test__`):

```js
export function calcEntryPnL(entry, currentPrice) {
  const sats = extractSats(entry);
  const fiat = extractFiat(entry);
  const price = toNumber(currentPrice, 0);
  const currentValue = (sats / SATS_PER_BTC) * price;
  if (sats === 0 && fiat === 0) {
    return { currentValue: 0, pnlValue: 0, pnlPct: 0, isProfit: false };
  }
  const pnlValue = currentValue - fiat;
  const pnlPct = fiat > 0 ? (pnlValue / fiat) * 100 : 0;
  return {
    currentValue,
    pnlValue,
    pnlPct,
    isProfit: pnlValue > 0
  };
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest tests/core-calculations.test.js --no-coverage 2>&1 | tail -10
```

Esperado: PASS — todos os testes de `calcEntryPnL` verdes

- [ ] **Step 5: Rodar suite completa para garantir que nada quebrou**

```bash
npm test 2>&1 | tail -15
```

Esperado: todos os testes passando

- [ ] **Step 6: Commit**

```bash
git add js/core/calculations.js tests/core-calculations.test.js
git commit -m "feat(core): adiciona calcEntryPnL usando extratores canônicos"
```

---

## Task 2: confirmedAt no txid-service

**Files:**
- Modify: `js/services/txid-service.js`
- Modify: `tests/txid-service.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao bloco `describe('txid-service')` em `tests/txid-service.test.js`:

```js
test('retorna confirmedAt em formato YYYY-MM-DD quando confirmado', async () => {
  const fetcher = async () => ({
    ok: true,
    json: async () => explorerPayload({ confirmed: true, time: 1710000000 })
  });
  const result = await validateTxidEntry(mockEntry(), { fetcher });
  // 1710000000 * 1000 = Date → '2024-03-09'
  expect(result.confirmedAt).toBe('2024-03-09');
});

test('confirmedAt é null quando não confirmado', async () => {
  const fetcher = async () => ({
    ok: true,
    json: async () => explorerPayload({ confirmed: false })
  });
  const result = await validateTxidEntry(mockEntry(), { fetcher });
  expect(result.confirmedAt).toBeNull();
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest tests/txid-service.test.js --no-coverage 2>&1 | tail -15
```

Esperado: FAIL — `result.confirmedAt` é `undefined`

- [ ] **Step 3: Expandir validateTxidEntry para retornar confirmedAt**

No bloco `try` de `validateTxidEntry`, dentro do retorno principal (após calcular `summary` e `decision`), substituir o `return` final por:

```js
    return {
      ...decision,
      txid: entry.txid,
      explorerUrl: buildExplorerUrl(entry.txid, { ...options, network: networkHint }),
      confirmations: summary.confirmations,
      expectedSats: summary.expectedSats,
      matchedSats: summary.wallet ? summary.toWallet : summary.totalOutputs,
      wallet: summary.wallet,
      network: resolveNetwork(networkHint),
      fetchedAt: new Date().toISOString(),
      confirmedAt: txData?.status?.confirmed && txData?.status?.block_time
        ? new Date(txData.status.block_time * 1000).toISOString().slice(0, 10)
        : null,
      raw: options.includeRaw ? txData : undefined
    };
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest tests/txid-service.test.js --no-coverage 2>&1 | tail -10
```

Esperado: PASS

- [ ] **Step 5: Rodar suite completa**

```bash
npm test 2>&1 | tail -15
```

Esperado: todos os testes passando

- [ ] **Step 6: Commit**

```bash
git add js/services/txid-service.js tests/txid-service.test.js
git commit -m "feat(txid-service): adiciona confirmedAt ao retorno de validateTxidEntry"
```

---

## Task 3: price-service.js

**Files:**
- Create: `js/services/price-service.js`
- Create: `tests/price-service.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/price-service.test.js`:

```js
import {
  createPriceService
} from '../js/services/price-service.js';

describe('price-service', () => {
  let service;

  afterEach(() => {
    if (service) service.stopPolling();
  });

  test('getCurrentPrice retorna null antes da primeira busca', () => {
    service = createPriceService({ fetcher: async () => 50000 });
    expect(service.getCurrentPrice('usd')).toBeNull();
  });

  test('onPriceUpdate notifica com o preço e vs corretos', async () => {
    const updates = [];
    service = createPriceService({ fetcher: async () => 50000 });
    service.onPriceUpdate(data => updates.push(data));
    await service.fetchNow('usd');
    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({ vs: 'usd', price: 50000, time: expect.any(Number) });
  });

  test('getCurrentPrice retorna o último preço após fetchNow', async () => {
    service = createPriceService({ fetcher: async () => 50000 });
    await service.fetchNow('usd');
    expect(service.getCurrentPrice('usd')).toBe(50000);
  });

  test('cache por moeda — usd e brl são independentes', async () => {
    let call = 0;
    service = createPriceService({ fetcher: async (vs) => vs === 'usd' ? 50000 : 300000 });
    await service.fetchNow('usd');
    await service.fetchNow('brl');
    expect(service.getCurrentPrice('usd')).toBe(50000);
    expect(service.getCurrentPrice('brl')).toBe(300000);
  });

  test('onPriceUpdate retorna função de unsubscribe', async () => {
    const updates = [];
    service = createPriceService({ fetcher: async () => 50000 });
    const unsub = service.onPriceUpdate(data => updates.push(data));
    unsub();
    await service.fetchNow('usd');
    expect(updates).toHaveLength(0);
  });

  test('em caso de falha no fetch, mantém cache anterior', async () => {
    let shouldFail = false;
    service = createPriceService({
      fetcher: async () => {
        if (shouldFail) throw new Error('Network error');
        return 50000;
      }
    });
    await service.fetchNow('usd');
    shouldFail = true;
    await service.fetchNow('usd');
    expect(service.getCurrentPrice('usd')).toBe(50000);
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest tests/price-service.test.js --no-coverage 2>&1 | tail -15
```

Esperado: FAIL — `Cannot find module`

- [ ] **Step 3: Implementar js/services/price-service.js**

Criar o arquivo:

```js
const DEFAULT_INTERVAL_MS = 30_000;

export function createPriceService({ fetcher, intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  const cache = {};
  const listeners = new Set();
  let pollingTimer = null;
  let currentVs = null;

  async function doFetch(vs) {
    try {
      const price = await fetcher(vs);
      if (typeof price === 'number' && Number.isFinite(price)) {
        cache[vs] = price;
        const payload = { vs, price, time: Date.now() };
        for (const fn of listeners) fn(payload);
      }
    } catch (_) {
      // mantém cache anterior — não propaga erro
    }
  }

  return {
    async fetchNow(vs) {
      await doFetch(vs);
    },

    startPolling(vs) {
      if (pollingTimer !== null && currentVs === vs) return;
      if (pollingTimer !== null) clearInterval(pollingTimer);
      currentVs = vs;
      doFetch(vs);
      pollingTimer = setInterval(() => doFetch(vs), intervalMs);
    },

    stopPolling() {
      if (pollingTimer !== null) {
        clearInterval(pollingTimer);
        pollingTimer = null;
        currentVs = null;
      }
    },

    getCurrentPrice(vs) {
      return cache[vs] ?? null;
    },

    onPriceUpdate(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  };
}
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest tests/price-service.test.js --no-coverage 2>&1 | tail -10
```

Esperado: PASS — 6 testes verdes

- [ ] **Step 5: Rodar suite completa**

```bash
npm test 2>&1 | tail -15
```

Esperado: todos passando

- [ ] **Step 6: Commit**

```bash
git add js/services/price-service.js tests/price-service.test.js
git commit -m "feat(price-service): cria serviço de preço BTC com polling e cache por moeda"
```

---

## Task 4: Formatadores de P&L em ui/table/helpers.js

**Files:**
- Modify: `js/ui/table/helpers.js`
- Create: `tests/ui-table-helpers.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/ui-table-helpers.test.js`:

```js
import { formatPnL, formatCurrentValue } from '../js/ui/table/helpers.js';

describe('ui/table/helpers — formatadores de P&L', () => {
  test('formatPnL retorna string com ▲ e + quando lucro', () => {
    const result = formatPnL({ pnlValue: 20, pnlPct: 25, isProfit: true }, 'USD');
    expect(result.sign).toBe('▲');
    expect(result.pctText).toBe('+25.00%');
    expect(result.valueText).toContain('20');
  });

  test('formatPnL retorna string com ▼ e - quando perda', () => {
    const result = formatPnL({ pnlValue: -20, pnlPct: -25, isProfit: false }, 'USD');
    expect(result.sign).toBe('▼');
    expect(result.pctText).toBe('-25.00%');
  });

  test('formatCurrentValue formata número monetário', () => {
    const text = formatCurrentValue(124.5, 'USD');
    expect(text).toContain('124');
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest tests/ui-table-helpers.test.js --no-coverage 2>&1 | tail -15
```

Esperado: FAIL — `formatPnL is not a function`

- [ ] **Step 3: Adicionar formatadores em js/ui/table/helpers.js**

Adicionar ao final do arquivo:

```js
export function formatCurrentValue(value, currency = 'USD') {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2
  }).format(value);
}

export function formatPnL({ pnlValue, pnlPct, isProfit } = {}, currency = 'USD') {
  if (!Number.isFinite(pnlValue)) return { sign: '—', valueText: '—', pctText: '—', isProfit: false };
  const sign = isProfit ? '▲' : '▼';
  const absValue = Math.abs(pnlValue);
  const prefix = isProfit ? '+' : '-';
  const valueText = formatCurrentValue(absValue, currency);
  const pctText = `${prefix}${Math.abs(pnlPct).toFixed(2)}%`;
  return { sign, valueText, pctText, isProfit };
}
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest tests/ui-table-helpers.test.js --no-coverage 2>&1 | tail -10
```

Esperado: PASS

- [ ] **Step 5: Rodar suite completa**

```bash
npm test 2>&1 | tail -15
```

Esperado: todos passando

- [ ] **Step 6: Commit**

```bash
git add js/ui/table/helpers.js tests/ui-table-helpers.test.js
git commit -m "feat(table/helpers): adiciona formatPnL e formatCurrentValue"
```

---

## Task 5: Coluna P&L na tabela + CSS

**Files:**
- Modify: `js/ui/table/render.js`
- Modify: `css/style.css`
- Modify: `index.html` — adicionar `<th>` de P&L no `<thead>`

- [ ] **Step 1: Adicionar `<th>` de P&L no index.html**

Abrir `index.html` e localizar o `<thead>` da tabela de transações. Adicionar após o `<th>` de preço e antes do `<th>` de status:

```html
<th>P&L</th>
```

- [ ] **Step 2: Atualizar colSpan do estado vazio em render.js**

Em `js/ui/table/render.js`, dentro da função `renderTable`, localizar:

```js
td.colSpan = 7;
```

Alterar para:

```js
td.colSpan = 8;
```

- [ ] **Step 3: Atualizar a assinatura de renderTable para receber currentPrice e currency**

Em `js/ui/table/render.js`, alterar a assinatura de `renderTable`:

```js
export function renderTable({
  list = [],
  totalCount = 0,
  activeFiltersCount = 0,
  currentPrice = null,
  currency = 'USD',
  createTxStatusBadge,
  fmtInt,
  fmtPrice
} = {}) {
```

- [ ] **Step 4: Adicionar a célula de P&L no loop de rows**

Em `js/ui/table/render.js`, dentro do `for (const tx of rows)`, após `tdPrice` e antes de `tdStatus`, adicionar:

```js
import { calcEntryPnL } from '../../core/calculations.js';
import { formatPnL, formatCurrentValue } from './helpers.js';
```

Adicionar no topo do arquivo (após imports existentes).

E no loop de rows, após criar `tdPrice`:

```js
    const tdPnl = document.createElement('td');
    tdPnl.className = 'num pnl-cell';
    if (currentPrice != null) {
      const pnlData = calcEntryPnL(tx, currentPrice);
      const fmt = formatPnL(pnlData, currency);
      const valueEl = document.createElement('span');
      valueEl.className = 'pnl-value';
      valueEl.textContent = formatCurrentValue(pnlData.currentValue, currency);
      const pctEl = document.createElement('span');
      pctEl.className = `pnl-pct ${pnlData.isProfit ? 'pnl-profit' : 'pnl-loss'}`;
      pctEl.textContent = `${fmt.sign} ${fmt.pctText}`;
      tdPnl.appendChild(valueEl);
      tdPnl.appendChild(pctEl);
    } else {
      tdPnl.textContent = '—';
      tdPnl.className = 'num pnl-cell muted';
    }
```

E no bloco de `tr.appendChild`:

```js
    tr.appendChild(tdDate);
    tr.appendChild(tdSats);
    tr.appendChild(tdPrice);
    tr.appendChild(tdPnl);   // ← adicionar aqui
    tr.appendChild(tdStatus);
    tr.appendChild(tdClassification);
    tr.appendChild(tdNote);
    tr.appendChild(tdAct);
```

- [ ] **Step 5: Adicionar CSS para coluna P&L**

Em `css/style.css`, adicionar ao final:

```css
/* P&L column */
.pnl-cell {
  white-space: nowrap;
  font-family: monospace;
}

.pnl-value {
  display: block;
  font-size: 0.85em;
  color: var(--text-muted, #888);
}

.pnl-pct {
  display: block;
  font-weight: 600;
  font-size: 0.9em;
  transition: color 0.3s ease;
}

.pnl-profit {
  color: #22c55e;
}

.pnl-loss {
  color: #ef4444;
}
```

- [ ] **Step 6: Rodar suite completa**

```bash
npm test 2>&1 | tail -15
```

Esperado: todos passando (render.js não tem testes unitários diretos — verificação visual será feita no Task 9)

- [ ] **Step 7: Commit**

```bash
git add js/ui/table/render.js css/style.css index.html
git commit -m "feat(table): adiciona coluna P&L com estilo financeiro verde/vermelho"
```

---

## Task 6: js/ui/chart/helpers.js

**Files:**
- Create: `js/ui/chart/helpers.js`
- Create: `tests/ui-chart-helpers.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/ui-chart-helpers.test.js`:

```js
import { buildPinDataset, buildPinModalData } from '../js/ui/chart/helpers.js';

describe('ui/chart/helpers', () => {
  const tx = {
    id: 'tx1',
    date: '2025-01-15',
    sats: 150000,
    fiatAmount: 80,
    btcPrice: 82000
  };

  test('buildPinDataset retorna array de pontos com x e y corretos', () => {
    const points = buildPinDataset([tx]);
    expect(points).toHaveLength(1);
    expect(points[0].x).toBe('2025-01-15');
    expect(points[0].y).toBe(82000);
    expect(points[0].txId).toBe('tx1');
  });

  test('buildPinDataset ignora entradas sem date ou btcPrice', () => {
    const bad = { id: 'x', sats: 100 };
    const points = buildPinDataset([tx, bad]);
    expect(points).toHaveLength(1);
  });

  test('buildPinModalData retorna os campos essenciais', () => {
    const modal = buildPinModalData(tx, 100000);
    expect(modal.date).toBe('2025-01-15');
    expect(modal.sats).toBe(150000);
    expect(modal.costFiat).toBe(80);
    expect(modal.currentValue).toBeCloseTo(150);
    expect(modal.isProfit).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest tests/ui-chart-helpers.test.js --no-coverage 2>&1 | tail -15
```

Esperado: FAIL — `Cannot find module`

- [ ] **Step 3: Implementar js/ui/chart/helpers.js**

Criar o arquivo:

```js
import { calcEntryPnL } from '../../core/calculations.js';
import { getTxPrice, getTxSats, getTxFiat, getTxDate } from '../table/helpers.js';

export function buildPinDataset(txs = []) {
  return txs
    .filter(tx => tx.date && getTxPrice(tx) > 0)
    .map(tx => ({
      x: getTxDate(tx),
      y: getTxPrice(tx),
      txId: tx.id
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
    isProfit: pnl.isProfit
  };
}
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest tests/ui-chart-helpers.test.js --no-coverage 2>&1 | tail -10
```

Esperado: PASS

- [ ] **Step 5: Rodar suite completa**

```bash
npm test 2>&1 | tail -15
```

Esperado: todos passando

- [ ] **Step 6: Commit**

```bash
git add js/ui/chart/helpers.js tests/ui-chart-helpers.test.js
git commit -m "feat(chart/helpers): buildPinDataset e buildPinModalData"
```

---

## Task 7: js/ui/chart/render.js — dataset de alfinetes

**Files:**
- Create: `js/ui/chart/render.js`

- [ ] **Step 1: Implementar js/ui/chart/render.js**

Criar o arquivo:

```js
import { buildPinDataset } from './helpers.js';

const PIN_DATASET_LABEL = '__btc_pins__';

export function buildPinsChartDataset(txs = []) {
  const points = buildPinDataset(txs);
  return {
    label: PIN_DATASET_LABEL,
    data: points,
    type: 'scatter',
    pointStyle: 'circle',
    pointRadius: 7,
    pointHoverRadius: 10,
    pointBackgroundColor: '#f7931a',
    pointBorderColor: '#ffffff',
    pointBorderWidth: 2,
    showLine: false,
    order: 0
  };
}

export function updatePinsDataset(chart, txs = []) {
  if (!chart) return;
  const existing = chart.data.datasets.findIndex(d => d.label === PIN_DATASET_LABEL);
  const dataset = buildPinsChartDataset(txs);
  if (existing >= 0) {
    chart.data.datasets[existing] = dataset;
  } else {
    chart.data.datasets.push(dataset);
  }
  chart.update('none');
}

export function removePinsDataset(chart) {
  if (!chart) return;
  const idx = chart.data.datasets.findIndex(d => d.label === PIN_DATASET_LABEL);
  if (idx >= 0) {
    chart.data.datasets.splice(idx, 1);
    chart.update('none');
  }
}

export { PIN_DATASET_LABEL };
```

- [ ] **Step 2: Rodar suite completa**

```bash
npm test 2>&1 | tail -15
```

Esperado: todos passando

- [ ] **Step 3: Commit**

```bash
git add js/ui/chart/render.js
git commit -m "feat(chart/render): dataset de alfinetes para Chart.js"
```

---

## Task 8: js/ui/chart/bind.js — clique no alfinete e modal

**Files:**
- Create: `js/ui/chart/bind.js`
- Modify: `css/style.css`

- [ ] **Step 1: Adicionar estilos do modal em css/style.css**

Adicionar ao final:

```css
/* Modal de alfinete */
#pinModal {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 1000;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.5);
}

#pinModal.open {
  display: flex;
}

.pin-modal-box {
  background: var(--bg-card, #1a1a2e);
  border: 1px solid var(--border, #333);
  border-radius: 12px;
  padding: 24px 28px;
  min-width: 260px;
  max-width: 340px;
  font-family: monospace;
}

.pin-modal-box h3 {
  margin: 0 0 16px;
  font-size: 1rem;
  color: var(--text, #eee);
}

.pin-modal-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 0.88rem;
  color: var(--text-muted, #aaa);
}

.pin-modal-row .pin-modal-val {
  color: var(--text, #eee);
  font-weight: 600;
}

.pin-modal-pnl.profit { color: #22c55e; }
.pin-modal-pnl.loss   { color: #ef4444; }

.pin-modal-close {
  margin-top: 16px;
  width: 100%;
  padding: 8px;
  cursor: pointer;
  border-radius: 6px;
  border: 1px solid var(--border, #333);
  background: transparent;
  color: var(--text-muted, #aaa);
  font-size: 0.85rem;
}
```

- [ ] **Step 2: Adicionar elemento #pinModal ao index.html**

Localizar o `</body>` em `index.html` e adicionar antes dele:

```html
<div id="pinModal" role="dialog" aria-modal="true" aria-label="Detalhes do aporte">
  <div class="pin-modal-box">
    <h3 id="pinModalTitle">Aporte</h3>
    <div class="pin-modal-row"><span>Data</span><span class="pin-modal-val" id="pinModalDate">—</span></div>
    <div class="pin-modal-row"><span>Sats</span><span class="pin-modal-val" id="pinModalSats">—</span></div>
    <div class="pin-modal-row"><span>Custo</span><span class="pin-modal-val" id="pinModalCost">—</span></div>
    <div class="pin-modal-row"><span>Hoje</span><span class="pin-modal-val" id="pinModalCurrent">—</span></div>
    <div class="pin-modal-row"><span>P&amp;L</span><span class="pin-modal-val pin-modal-pnl" id="pinModalPnl">—</span></div>
    <button class="pin-modal-close" id="pinModalClose">Fechar</button>
  </div>
</div>
```

- [ ] **Step 3: Implementar js/ui/chart/bind.js**

Criar o arquivo:

```js
import { buildPinModalData } from './helpers.js';
import { formatCurrentValue, formatPnL } from '../table/helpers.js';
import { PIN_DATASET_LABEL } from './render.js';

function openPinModal(tx, currentPrice, currency = 'USD') {
  const data = buildPinModalData(tx, currentPrice);
  const fmt = formatPnL(data, currency);

  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  set('pinModalTitle', `Aporte — ${data.date}`);
  set('pinModalDate', data.date);
  set('pinModalSats', data.sats.toLocaleString('pt-BR') + ' sats');
  set('pinModalCost', formatCurrentValue(data.costFiat, currency));
  set('pinModalCurrent', formatCurrentValue(data.currentValue, currency));
  set('pinModalPnl', `${fmt.sign} ${fmt.pctText}`);

  const pnlEl = document.getElementById('pinModalPnl');
  if (pnlEl) {
    pnlEl.classList.toggle('profit', data.isProfit);
    pnlEl.classList.toggle('loss', !data.isProfit);
  }

  const modal = document.getElementById('pinModal');
  if (modal) modal.classList.add('open');
}

function closePinModal() {
  const modal = document.getElementById('pinModal');
  if (modal) modal.classList.remove('open');
}

export function bindChartPins({ chart, getTxById, getCurrentPrice, getCurrency }) {
  if (!chart) return;

  chart.options.onClick = (evt, elements) => {
    if (!elements || elements.length === 0) return;
    const el = elements[0];
    const dataset = chart.data.datasets[el.datasetIndex];
    if (!dataset || dataset.label !== PIN_DATASET_LABEL) return;
    const point = dataset.data[el.index];
    if (!point?.txId) return;
    const tx = getTxById(point.txId);
    if (!tx) return;
    const price = getCurrentPrice();
    const currency = getCurrency();
    openPinModal(tx, price, currency);
  };

  chart.update('none');

  const closeBtn = document.getElementById('pinModalClose');
  if (closeBtn) closeBtn.addEventListener('click', closePinModal);

  const modal = document.getElementById('pinModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closePinModal();
    });
  }
}
```

- [ ] **Step 4: Rodar suite completa**

```bash
npm test 2>&1 | tail -15
```

Esperado: todos passando

- [ ] **Step 5: Commit**

```bash
git add js/ui/chart/bind.js css/style.css index.html
git commit -m "feat(chart/bind): clique em alfinete abre modal de detalhes do aporte"
```

---

## Task 9: Integração em app.js

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: Importar os novos módulos no topo de app.js**

Adicionar após os imports existentes:

```js
import { createPriceService } from './services/price-service.js';
import { updatePinsDataset } from './ui/chart/render.js';
import { bindChartPins } from './ui/chart/bind.js';
```

- [ ] **Step 2: Declarar priceService após as declarações de variáveis**

Após a linha `let _chart = null;` (linha 2548), adicionar:

```js
let priceService = null;
```

> Não criar uma variável `chartInstance` paralela. O gráfico real é `_chart`, recriado a cada `renderChart()`. Os pins devem sempre operar sobre `_chart` diretamente.

- [ ] **Step 3: Criar a função getCoinGeckoPrice que o price-service usará**

Localizar onde o app já busca o preço atual no CoinGecko (procurar por `coingecko` ou `simple/price` no app.js). Extrair o fetcher para ser passado ao `createPriceService`:

```js
function createCoinGeckoFetcher() {
  return async function(vs) {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=${vs}`;
    const res = await fetch(url);
    const json = await res.json();
    return json?.bitcoin?.[vs] ?? null;
  };
}
```

- [ ] **Step 4: Inicializar price-service no boot**

Localizar a função `boot()` ou equivalente de inicialização. Adicionar no início do boot:

```js
  const vs = state.vs || 'usd';
  priceService = createPriceService({ fetcher: createCoinGeckoFetcher() });
  priceService.onPriceUpdate(() => {
    renderAll(); // atualiza tabela e stats — NÃO recria o gráfico (renderAll não chama renderChart)
  });
  priceService.startPolling(vs);
```

- [ ] **Step 5: Passar currentPrice e currency para renderTable**

Localizar a chamada de `renderTable(...)` no app.js. Adicionar os novos parâmetros:

```js
  renderTable({
    list: filtered,
    totalCount: state.txs.length,
    activeFiltersCount: Object.values(filterState).filter(Boolean).length,
    currentPrice: priceService?.getCurrentPrice(state.vs || 'usd') ?? null,
    currency: (state.vs || 'usd').toUpperCase(),
    createTxStatusBadge,
    fmtInt,
    fmtPrice
  });
```

- [ ] **Step 6: Integrar pins diretamente em renderChart()**

`renderChart()` destrói e recria `_chart` a cada chamada (linha 2576-2577 de app.js). Por isso, os pins devem ser adicionados **dentro de `renderChart()`**, logo após a linha `_chart = new Chart(canvas.getContext('2d'), cfg);`:

```js
  _chart = new Chart(canvas.getContext('2d'), cfg);
  try { window.btcChart = _chart; } catch (e) { /* ignore in strict CSP env */ }

  // Pins: adicionar dataset e bind na nova instância
  updatePinsDataset(_chart, state.txs);
  bindChartPins({
    chart: _chart,
    getTxById: (id) => state.txs.find(tx => tx.id === id),
    getCurrentPrice: () => priceService?.getCurrentPrice(state.vs || 'usd') ?? null,
    getCurrency: () => (state.vs || 'usd').toUpperCase()
  });
```

> `bindChartPins` registra `chart.options.onClick` e os listeners de fechar modal. Como `_chart` é destruído e recriado a cada render, o bind também precisa ser repetido. Os listeners do DOM (`#pinModalClose`, `#pinModal`) devem ser registrados com `{ once: false }` e verificar duplicação — ou usar `{ once: true }` e re-registrar apenas se o modal não tiver listener ativo. O `bind.js` já cuida disso internamente verificando `#pinModal`.

- [ ] **Step 7: Aplicar confirmedAt após validação de TXID**

Localizar onde o app processa o resultado de `validateTxidEntry`. Adicionar após salvar o resultado de validação:

```js
  if (result.confirmedAt && tx.date !== result.confirmedAt) {
    tx.date = result.confirmedAt;
  }
```

- [ ] **Step 8: Reiniciar polling quando vs muda**

Localizar onde o app troca a moeda (`vs`). Adicionar:

```js
  if (priceService) {
    priceService.startPolling(newVs); // startPolling já reinicia se vs mudou
  }
```

- [ ] **Step 9: Rodar suite completa**

```bash
npm test 2>&1 | tail -15
```

Esperado: todos passando

- [ ] **Step 10: Commit**

```bash
git add js/app.js
git commit -m "feat(app): integra price-service, chart pins e confirmedAt no boot"
```

---

## Verificação Final

- [ ] Rodar `npm test` — CI deve estar verde com todas as suites
- [ ] Abrir `index.html` no browser e confirmar:
  - Coluna P&L visível na tabela com valores verdes/vermelhos
  - Alfinetes laranja no gráfico em cada data de aporte
  - Clique no alfinete abre modal com data, sats, custo, hoje e P&L
  - Preço atualiza a cada 30s (verificar no DevTools — Network)
- [ ] Validar um TXID com data diferente da manual e confirmar que o alfinete se move
- [ ] Commit final se houver ajustes de polish

---

## Referências

- Spec: `docs/superpowers/specs/2026-04-15-pnl-chart-pins-design.md`
- Extratores existentes: `js/core/calculations.js` (`extractSats`, `extractFiat`)
- Helpers de shape híbrido: `js/ui/table/helpers.js` (`getTxSats`, `getTxFiat`, `getTxPrice`)
- Contrato de `confirmedAt`: `txData.status.block_time` (Unix s) → ISO `YYYY-MM-DD`
