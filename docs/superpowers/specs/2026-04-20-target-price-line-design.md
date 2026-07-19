# Target Price Line no Gráfico — Design Spec

**Data:** 2026-04-20
**Estado:** Implementado e validado

---

## Objetivo

Permitir que Lucas defina um preço-alvo em USD e veja-o como linha horizontal persistente no gráfico histórico de preço BTC, sem sair do contexto do gráfico.

---

## Contexto e decisões

- **Posicionamento:** header do card do gráfico (`.chart-head`), à direita do título — acesso rápido sem abrir menus, contextual ao gráfico.
- **Moeda:** sempre USD. Se o seletor estiver noutra moeda, o input fica desabilitado com microcopy. A conversão de unidades fica fora de scope deste lote.
- **Persistência:** nenhuma neste lote. `targetPriceUsd` vive em estado efemero de modulo, fora do objeto salvo por `saveState()`, e limpa ao recarregar a pagina.
- **Plugin:** `chartjs-plugin-annotation` já registado em `app.js`. Usar directamente — sem novo plugin, sem dataset fictício.
- **Update — dois paths complementares:**
  1. **Path canónico (re-renders):** `buildChartConfig()` lê `targetPriceUsd` e inclui a annotation `targetPrice` na config que constrói. Qualquer re-render (filtros, ano, moeda, refresh de série) reconstrói o chart com o target já incluído.
  2. **Path live (keystroke):** após actualizar `targetPriceUsd`, mutação directa de `_chart.options.plugins.annotation.annotations` + `_chart.update('none')` para resposta imediata sem rebuild completo. Este path só serve para a UX do input — o chart re-renderizado pelo path canónico já inclui o estado correcto.

---

## Componentes

### 1. Input no chart-head (`index.html`)

```html
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
```

### 2. Estilos (`css/style.css`)

```css
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

Mobile (≤480px): o `.chart-head` já usa `display: flex; justify-content: space-between`. O `target-price-wrap` com `align-items: flex-end` mantém alinhamento. O input de 120px cabe sem quebrar a 375px.

### 3. State (`app.js`)

Adicionar como estado efemero no modulo, fora do objecto persistido:

```js
let targetPriceUsd = null; // estado efemero, fora de saveState()
```

### 4. Handler do input (`app.js`)

```js
function bindTargetPrice() {
  const input = document.getElementById('targetPriceInput');
  const hint  = document.getElementById('targetPriceCurrencyHint');
  if (!input) return;

  function syncCurrencyGuard() {
    const isUsd = resolvedVsCurrencyLower() === 'usd';
    input.disabled = !isUsd;
    if (hint) hint.hidden = isUsd;
    if (!isUsd) {
      // Limpa campo E estado ao sair de USD — sem ambiguidade ao voltar
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

  // Chamado sempre que vsCurrency muda
  return syncCurrencyGuard;
}
```

`syncCurrencyGuard` é invocado a partir do handler existente de mudança de `vsCurrency`.

**Semântica ao mudar moeda:** ao sair de USD, campo e estado são limpos. Ao voltar para USD, o campo está vazio — o utilizador reintroduz o target se quiser. Sem reidratação implícita de valor anterior.

### 5. Annotation update (`app.js`)

```js
function updateTargetAnnotation() {
  if (!_chart) return;

  const annotations = _chart.options.plugins?.annotation?.annotations ?? {};

  if (targetPriceUsd) {
    annotations.targetPrice = {
      type: 'line',
      scaleID: 'y',
      value: targetPriceUsd,
      adjustScaleRange: false,
      borderColor: getComputedStyle(document.documentElement)
                     .getPropertyValue('--color-status-warn').trim(),
      borderWidth: 1,
      borderDash: [6, 4],
      label: {
        display: true,
        content: `▸ $${targetPriceUsd.toLocaleString('en-US')}`,
        position: 'end',
        color: getComputedStyle(document.documentElement)
                 .getPropertyValue('--color-status-warn').trim(),
        backgroundColor: 'transparent',
        font: { size: 11 },
      },
    };
  } else {
    delete annotations.targetPrice;
  }

  if (!_chart.options.plugins) _chart.options.plugins = {};
  if (!_chart.options.plugins.annotation) _chart.options.plugins.annotation = {};
  _chart.options.plugins.annotation.annotations = annotations;
  _chart.update('none');
}
```

`_chart.update('none')` — sem animação, sem re-layout de eixos. Só redesenha as annotations.

---

## Fluxo completo

1. Página carrega → `targetPriceUsd = null`, input vazio, sem linha.
2. `vsCurrency` é `usd` → input activo.
3. Lucas escreve `"70000"` → `targetPriceUsd = 70000` → `updateTargetAnnotation()` → linha amber aparece com label `"▸ $70,000"`.
4. Lucas apaga o valor → `targetPriceUsd = null` → linha desaparece.
5. Lucas muda `vsCurrency` para `eur` → `syncCurrencyGuard()` → input desabilitado, hint visível, linha removida.
6. Lucas volta para `usd` → input reactivado, mas valor anterior está limpo (sem state de conversão).

---

## Critérios de aceitação

- [x] Input visível no header do card do gráfico, sem quebrar layout desktop nem mobile (375px)
- [x] Input activo apenas quando a moeda selecionada e `usd`; desabilitado com microcopy "Disponível apenas em USD" caso contrário
- [x] Linha horizontal amber aparece imediatamente ao digitar um valor > 0
- [x] Label `"▸ $X,XXX"` visível à direita da linha
- [x] Campo vazio ou zero → linha desaparece sem erros no console
- [x] Nenhuma regressão no crosshair, na linha de preço médio, ou nos pins de aportes
- [x] Nenhum hex literal introduzido no CSS (lint gate)

---

## Fora de scope

- Persistência em localStorage
- Suporte a EUR/BRL (requer conversão de taxa de câmbio)
- Múltiplos targets
- Alertas quando o preço atinge o target (candidato B do backlog)
