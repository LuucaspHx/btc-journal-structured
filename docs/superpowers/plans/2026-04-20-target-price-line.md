# Target Price Line Implementation Plan

> **STATUS: IMPLEMENTADO** em `codex/target-price-line`. Validado com 16 suites / 100 testes, audit de tokens e smoke desktop/mobile a 375 px.
> **Decisoes as-built:** o helper puro vive em `js/ui/chart/helpers.js`; `targetPriceUsd` e estado efemero de modulo para nunca entrar em `saveState()`; `adjustScaleRange: false` impede que targets fora da serie distorcam o eixo Y.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a horizontal amber dashed line to the BTC price chart at a user-defined USD target, entered via an input in the chart card header, active only when the currency selector is set to USD.

**Architecture:** Three-layer change — HTML markup (chart header restructure + input), CSS tokens-only styles, a pure annotation builder in `js/ui/chart/helpers.js`, integration into `buildChartConfig()` (canonical re-render path), and an input handler (`bindTargetPrice()`) with a live mutation path (`updateTargetAnnotation()`). The live path only handles keystroke responsiveness; the canonical path ensures the annotation survives every chart rebuild.

**Tech Stack:** Vanilla JS (ES modules), Chart.js 4, `chartjs-plugin-annotation@3.0.1` (already loaded via CDN and registered in `app.js`), `chartTokens` from `js/ui/chart/tokens.js` (already imported in `app.js` at line 55).

---

## File Map

| File | Change |
|------|--------|
| `index.html` | Restructure chart card header (`~line 372`) into `.chart-head` + add input markup |
| `css/style.css` | Append `.target-price-wrap`, `.target-price-input`, `.target-price-hint` styles |
| `js/ui/chart/helpers.js` | Pure `buildTargetPriceAnnotation()` helper |
| `js/app.js` | Ephemeral `targetPriceUsd`, `buildChartConfig()` annotation integration, `updateTargetAnnotation()`, `bindTargetPrice()`, currency guard and init wiring |

---

## Task 1: HTML — Chart header restructure + input markup

**Files:**
- Modify: `index.html` ~line 372–374

The current chart card header is a plain `div` with inline `font-weight:800`. The spec requires a `.chart-head` wrapper (class already styled in `css/style.css` at line 130: `display:flex; justify-content:space-between; align-items:center`). Restructure it and add the input.

- [x] **Step 1: Locate the block to replace**

In `index.html`, find this block (around line 372):

```html
<div class="card chart-main-card section-panel" id="chartSection" data-section-panel="chart">
  <div style="font-weight:800;">Gráfico BTC e marcadores de aportes</div>
  <div id="chartContainer" style="height:320px; margin-top:8px;">
```

- [x] **Step 2: Replace with `.chart-head` structure**

Replace the block above with:

```html
<div class="card chart-main-card section-panel" id="chartSection" data-section-panel="chart">
  <div class="chart-head">
    <h2 class="chart-title">Gráfico BTC e marcadores de aportes</h2>
    <div class="target-price-wrap">
      <input
        id="targetPriceInput"
        class="target-price-input"
        type="number"
        min="0"
        step="1000"
        placeholder="Target (USD)"
        aria-label="Preço-alvo em USD"
      />
      <span id="targetPriceCurrencyHint" class="target-price-hint" hidden>
        Disponível apenas em USD
      </span>
    </div>
  </div>
  <div id="chartContainer" style="height:320px; margin-top:8px;">
```

- [x] **Step 3: Verify HTML is valid — open in browser, confirm the chart card title still renders and no layout breaks**

No automated test — visual check. The `.chart-head` flex row should show the title on the left and the input on the right.

- [x] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(html): chart-head structure + target price input markup"
```

---

## Task 2: CSS — Target price input styles

**Files:**
- Modify: `css/style.css` (append to end, before the closing `@media (max-width: 480px)` block — or after it; either is fine as specificity is flat)

All styles must use design tokens. No hex literals — the pre-commit lint gate will block the commit if any `+` lines contain raw hex.

- [x] **Step 1: Append the styles to `css/style.css`**

Add after the last existing rule (before or after the mobile block — keep mobile block last):

```css
/* ── Target Price Input ─────────────────────────────────── */
.target-price-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.target-price-input {
  width: 120px;
  font-family: var(--font-data);
  font-size: var(--text-sm);
  padding: 4px 8px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-surface-2);
  color: var(--color-text-primary);
  text-align: right;
}

.target-price-input:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.target-price-hint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}
```

- [x] **Step 2: Run the lint gate locally to confirm no hex literals**

```bash
bash scripts/lint-tokens.sh
```

Expected output: no errors (exit 0). If the script complains, check for stray `#` characters in the added lines.

- [x] **Step 3: Visual check — open the app in a browser**

Confirm:
- Input renders in the chart header, right-aligned, 120px wide
- Placeholder text "Target (USD)" visible
- No layout break at desktop width

- [x] **Step 4: Commit**

```bash
git add css/style.css
git commit -m "feat(css): target price input styles — tokens only"
```

---

## Task 3: chart helper — Pure annotation builder + unit test

**Files:**
- Modify: `js/ui/chart/helpers.js` (add `buildTargetPriceAnnotation`)
- Modify: `tests/ui-chart-helpers.test.js` (append tests)

Extract the annotation shape as a pure function so it is independently testable. `buildChartConfig` will call it in Task 4.

- [x] **Step 1: Write the failing tests first**

Open `tests/ui-chart-helpers.test.js`. At the end of the file, append:

```js
// ── buildTargetPriceAnnotation ──────────────────────────
import { buildTargetPriceAnnotation } from '../js/ui/chart/helpers.js';

describe('buildTargetPriceAnnotation', () => {
  test('returns null for null input', () => {
    expect(buildTargetPriceAnnotation(null)).toBeNull();
  });

  test('returns null for zero', () => {
    expect(buildTargetPriceAnnotation(0)).toBeNull();
  });

  test('returns null for negative', () => {
    expect(buildTargetPriceAnnotation(-1000)).toBeNull();
  });

  test('returns annotation config for valid positive value', () => {
    const ann = buildTargetPriceAnnotation(70000);
    expect(ann).not.toBeNull();
    expect(ann.type).toBe('line');
    expect(ann.scaleID).toBe('y');
    expect(ann.value).toBe(70000);
    expect(ann.borderWidth).toBe(1);
    expect(Array.isArray(ann.borderDash)).toBe(true);
    expect(ann.label.display).toBe(true);
    expect(ann.label.content).toBe('▸ $70,000');
    expect(ann.label.position).toBe('end');
  });

  test('formats value with en-US locale separator', () => {
    const ann = buildTargetPriceAnnotation(1000000);
    expect(ann.label.content).toBe('▸ $1,000,000');
  });
});
```

- [x] **Step 2: Run tests — confirm they fail**

```bash
npm test -- --testPathPattern=ui-chart-helpers
```

Expected: `SyntaxError` or `export not found` — the function doesn't exist yet.

- [x] **Step 3: Add and export `buildTargetPriceAnnotation` from `js/ui/chart/helpers.js`**

In `js/ui/chart/helpers.js`, add:

```js
/**
 * Builds a Chart.js annotation config for the target price line.
 * Pure function — reads no global state, safe to test in isolation.
 * Colors are read via chartTokens at call time (runtime, not import time).
 * @param {number|null} valueUsd
 * @returns {object|null} annotation config or null if value is invalid
 */
export function buildTargetPriceAnnotation(valueUsd) {
  if (!Number.isFinite(valueUsd) || valueUsd <= 0) return null;
  const color = chartTokens.warn();
  return {
    type: 'line',
    scaleID: 'y',
    value: valueUsd,
    borderColor: color,
    borderWidth: 1,
    borderDash: [6, 4],
    label: {
      display: true,
      content: `▸ $${valueUsd.toLocaleString('en-US')}`,
      position: 'end',
      color,
      backgroundColor: 'transparent',
      font: { size: 11 },
    },
  };
}
```

- [x] **Step 4: Run tests — confirm they pass**

```bash
npm test -- --testPathPattern=ui-chart-helpers
```

Expected: all tests in `ui-chart-helpers.test.js` PASS. The new `buildTargetPriceAnnotation` tests should pass. Existing tests should be unaffected.

- [x] **Step 5: Run full suite to confirm no regressions**

```bash
npm test
```

Expected: all tests pass (same count as before plus the 5 new ones).

- [x] **Step 6: Commit**

```bash
git add js/ui/chart/helpers.js tests/ui-chart-helpers.test.js
git commit -m "feat(chart): add tested target annotation builder"
```

---

## Task 4: app.js — Integrate annotation into `buildChartConfig()` (canonical path)

**Files:**
- Modify: `js/app.js` ~lines 2825–2847 (the annotation block inside `buildChartConfig`)

This is the canonical path: every chart rebuild (filter change, year change, currency change, data refresh) goes through `buildChartConfig`. The target annotation must be included here so it is never lost on re-render.

- [x] **Step 1: Locate the existing annotation block**

In `js/app.js`, find this block inside `buildChartConfig` (lines ~2825–2847):

```js
  if (useAnnotation && series.avgPrice > 0) {
    cfg.options.plugins = cfg.options.plugins || {};
    cfg.options.plugins.annotation = {
      annotations: {
        avgLine: {
          type: 'line',
          yMin: series.avgPrice,
          yMax: series.avgPrice,
          borderColor: chartTokens.warn(),
          borderWidth: 1,
          borderDash: [6, 6],
          label: {
            enabled: true,
            content: `PM ${fmtCurrency(series.avgPrice, vsLabel)}`,
            position: 'end',
            backgroundColor: chartTokens.bgSurface(),
            color: chartTokens.warn(),
            padding: 4,
          },
        },
      },
    };
  }
```

- [x] **Step 2: Replace with refactored block that includes both avgLine and targetPrice**

Replace the block above with:

```js
  const targetAnn = buildTargetPriceAnnotation(targetPriceUsd);
  const needsAnnotation = useAnnotation && (series.avgPrice > 0 || targetAnn !== null);
  if (needsAnnotation) {
    cfg.options.plugins = cfg.options.plugins || {};
    const annotations = {};
    if (series.avgPrice > 0) {
      annotations.avgLine = {
        type: 'line',
        yMin: series.avgPrice,
        yMax: series.avgPrice,
        borderColor: chartTokens.warn(),
        borderWidth: 1,
        borderDash: [6, 6],
        label: {
          enabled: true,
          content: `PM ${fmtCurrency(series.avgPrice, vsLabel)}`,
          position: 'end',
          backgroundColor: chartTokens.bgSurface(),
          color: chartTokens.warn(),
          padding: 4,
        },
      };
    }
    if (targetAnn) annotations.targetPrice = targetAnn;
    cfg.options.plugins.annotation = { annotations };
  }
```

- [x] **Step 3: Run full test suite**

```bash
npm test
```

Expected: all tests pass (no regressions in `core-*` or `ui-*` tests).

- [x] **Step 4: Manual smoke test in browser**

Open the app, enter a target such as `70000`, trigger a chart rebuild and confirm the dashed amber line remains visible with the `▸ $70,000` label.

- [x] **Step 5: Commit**

```bash
git add js/app.js
git commit -m "feat(chart): integrate targetPrice annotation in buildChartConfig canonical path"
```

---

## Task 5: app.js — State, live update, input handler, wiring

**Files:**
- Modify: `js/app.js`:
  - module scope — add ephemeral `targetPriceUsd`
  - after `buildTargetPriceAnnotation` (before `buildChartConfig`) — add `updateTargetAnnotation()`
  - after `updateTargetAnnotation` — add `bindTargetPrice()`
  - ~line 3473 — wire `syncCurrencyGuard` into the vsCurrency `change` handler
  - near end of init sequence — call `bindTargetPrice()`

- [x] **Step 1: Add module-local `targetPriceUsd` state**

Keep the value outside the persisted application state:

```js
let targetPriceUsd = null;
```

- [x] **Step 2: Add `updateTargetAnnotation()` — the live path**

In `js/app.js`, near `buildChartConfig()`, add:

```js
/**
 * Mutates the live chart's annotation config for the target price line.
 * Called on every keystroke to avoid full chart rebuild.
 * The canonical path (buildChartConfig) ensures the annotation also
 * survives any full re-render.
 */
function updateTargetAnnotation() {
  if (!_chart) return;
  const annotations = _chart.options.plugins?.annotation?.annotations ?? {};
  const ann = buildTargetPriceAnnotation(targetPriceUsd);
  if (ann) {
    annotations.targetPrice = ann;
  } else {
    delete annotations.targetPrice;
  }
  if (!_chart.options.plugins) _chart.options.plugins = {};
  if (!_chart.options.plugins.annotation) _chart.options.plugins.annotation = {};
  _chart.options.plugins.annotation.annotations = annotations;
  _chart.update('none');
}
```

- [x] **Step 3: Add `bindTargetPrice()` — input handler + guard**

Immediately after `updateTargetAnnotation()`, insert:

```js
/**
 * Binds the #targetPriceInput element.
 * Returns syncCurrencyGuard so the vsCurrency handler can call it.
 */
function bindTargetPrice() {
  const input = document.getElementById('targetPriceInput');
  const hint  = document.getElementById('targetPriceCurrencyHint');
  if (!input) return () => {};

  function syncCurrencyGuard() {
    const isUsd = (document.getElementById('vsCurrency')?.value || 'usd') === 'usd';
    input.disabled = !isUsd;
    if (hint) hint.hidden = isUsd;
    if (!isUsd) {
      input.value = '';
      targetPriceUsd = null;
      updateTargetAnnotation();
    }
  }

  input.addEventListener('input', () => {
    const raw = parseFloat(input.value);
    targetPriceUsd = Number.isFinite(raw) && raw > 0 ? raw : null;
    updateTargetAnnotation();
  });

  return syncCurrencyGuard;
}
```

- [x] **Step 4: Wire `syncCurrencyGuard` into the vsCurrency change handler**

In `js/app.js`, find the `change` event listener (~line 3472). It currently looks like:

```js
document.addEventListener('change', async (e) => {
  if (e.target && e.target.id === 'vsCurrency') {
    state.vs = e.target.value;
    try {
      await fetchPrices(expandRange(ensureChartRange()), state.vs);
    } catch (error) {
      console.warn('Currency switch price fetch failed', error);
    }
    if (document.getElementById('chartMode')?.value === 'candles') await fetchOHLC(90);
    renderChart();
    const overlay = document.getElementById('chartGlassOverlay');
    if (overlay && overlay.style.display === 'flex') renderChartToCanvas('glassBtcChart');
  }
```

Add `syncCurrencyGuard?.()` call after `state.vs = e.target.value`. The guard must run BEFORE `renderChart()` so the state is clean when the canonical rebuild happens.

Change the block to:

```js
document.addEventListener('change', async (e) => {
  if (e.target && e.target.id === 'vsCurrency') {
    state.vs = e.target.value;
    syncCurrencyGuard?.();
    try {
      await fetchPrices(expandRange(ensureChartRange()), state.vs);
    } catch (error) {
      console.warn('Currency switch price fetch failed', error);
    }
    if (document.getElementById('chartMode')?.value === 'candles') await fetchOHLC(90);
    renderChart();
    const overlay = document.getElementById('chartGlassOverlay');
    if (overlay && overlay.style.display === 'flex') renderChartToCanvas('glassBtcChart');
  }
```

- [x] **Step 5: Declare `syncCurrencyGuard` at module scope and call `bindTargetPrice()` at init**

`syncCurrencyGuard` must be accessible in the `change` event listener. Add a module-level declaration near the other module-level `let` declarations (around line 61–66):

```js
let syncCurrencyGuard = null;
```

Then find the app's initialization sequence — the section that calls `bindChartPins`, sets up the chart, etc. Search for a place near other `bind*` calls or after the chart is first rendered. Add:

```js
syncCurrencyGuard = bindTargetPrice();
```

To find a suitable location, search for `bindChartPins` in `app.js` to find the init section:

```bash
grep -n "bindChartPins\|bindChart\|DOMContentLoaded\|renderChart()" js/app.js | tail -20
```

Place `syncCurrencyGuard = bindTargetPrice();` immediately after the existing `bindChartPins(...)` call. This guarantees the input is bound after the DOM is ready and after the chart has been initialized (so `_chart` is available for immediate annotation updates if needed).

- [x] **Step 6: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [x] **Step 7: Full acceptance test in browser**

Test each criterion from the spec:

1. Input visible in chart header — ✓ title left, input right
2. Moeda selecionada `usd` (default) → input enabled, hint hidden
3. Type `70000` → dashed amber line appears at $70,000 with label `▸ $70,000`
4. Clear input → line disappears, no console errors
5. Change currency to `eur` → input disabled, hint "Disponível apenas em USD" visible, line removed
6. Change back to `usd` → input re-enabled, field is empty
7. Apply a chart filter (year picker or entry toggle) → target line survives the re-render
8. Open browser console — zero errors

- [x] **Step 8: Commit**

```bash
git add js/app.js
git commit -m "feat(chart): target price line — state, live update, input handler, wiring"
```

---

## Acceptance Criteria Checklist (from spec)

- [x] Input visível no header do card do gráfico, sem quebrar layout desktop nem mobile (375px)
- [x] Input activo apenas quando a moeda selecionada e `usd`; desabilitado com microcopy "Disponível apenas em USD" caso contrário
- [x] Linha horizontal amber aparece imediatamente ao digitar um valor > 0
- [x] Label `"▸ $X,XXX"` visível à direita da linha
- [x] Campo vazio ou zero → linha desaparece sem erros no console
- [x] Nenhuma regressão no crosshair, na linha PM, ou nos pins de aportes
- [x] Nenhum hex literal introduzido no CSS (lint gate)
