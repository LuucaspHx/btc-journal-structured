# Design System Foundation
**Projecto:** BTC Journal Structured
**Data:** 2026-04-18
**Estado:** APROVADO — base congelada
**Autores:** Claude Code + Codex (revisão)

---

## 0. Princípios

Cinco princípios. Cada um com um anti-exemplo concreto do código actual.

| Princípio | Definição | Anti-exemplo actual |
|---|---|---|
| **Dados acima de decoração** | Cada elemento visual existe para comunicar informação ou criar respiração intencional. Nada decorativo sem propósito declarado. | `glass-card::after { filter: url(#glass-distortion) }` — SVG turbulence que não comunica nada e custa GPU |
| **Dark-first real** | O tema base é escuro. Não é "claro com fundo cinzento". Fundos próximos de preto, superfícies com elevação via lightness diferencial. | `:root { --bg: #f5f5f7; --panel: #ffffff }` — light tokens como base, dark como alternativa não activada |
| **Fonte única de verdade** | Nenhum valor primitivo nasce fora de `css/tokens.css`. Toda a cor, espaçamento e tipografia deriva dos tokens. | `background: linear-gradient(180deg, #fff, #f7f7f8)` em `.kpi` — valor primitivo inventado inline |
| **Contratos explícitos** | Cada componente tem uma interface declarada: quando usar, quais estados tem, quais tokens consome. Sem uso implícito por conveniência. | `.glass-card` usado em cards, sidebar, overlays e gráficos — sem critério de aplicação |
| **Densidade respeitosa** | Layout denso como referência (CoinMarketCap) mas com espaçamento suficiente para não cansar. Sem hero metrics vazios, sem cards gigantes com pouca informação. | `.kpi { padding: 14px }` com apenas 3 valores — área desperdiçada em relação à informação apresentada |

---

## 1. Token Architecture

### 1.1 Fonte de Verdade

```
css/tokens.css          ← SoT. Único ficheiro onde nascem valores primitivos.
css/style.css           ← Consome tokens via var(). Zero valores primitivos.
js/ui/chart/tokens.js   ← Bridge runtime. Lê tokens CSS via getComputedStyle.
```

**Regra do contrato:**
> Nenhum valor primitivo novo (hex, oklch literal, rem literal, string de fonte) aparece fora de `css/tokens.css`.

`var(--color-bg-page)` em `style.css` é uso legítimo — o sistema a funcionar.
`#0a0c0f` em `style.css` é violação de contrato — independentemente de ser "o mesmo valor".

### 1.2 Naming Convention

Dois níveis. Terceiro nível opt-in por critério (ver secção 1.4).

```
Nível 1 — Primitivo
--primitive-{escala}-{step}
Exemplos: --primitive-gray-950, --primitive-orange-500, --primitive-space-4

Nível 2 — Semântico
--color-{papel}[-{variante}]
--space-{tamanho}
--font-{papel}
--duration-{velocidade}
Exemplos: --color-bg-page, --color-text-primary, --space-md, --font-ui, --duration-fast

Nível 3 — Componente (opt-in)
--{componente}-{propriedade}[-{estado}]
Exemplos: --kpi-bg, --goal-card-border-active
```

### 1.3 Regra de Violação

Uma mudança é uma violação se:
- Introduz um valor primitivo fora de `css/tokens.css`
- Usa `var()` de um token que não existe no ficheiro de tokens
- Cria um alias circular (`--color-a: var(--color-a)`)
- Define uma propriedade CSS que devia usar um token semântico com valor literal

### 1.4 Critério de Promoção para Component Tokens

Um componente qualifica para tokens próprios quando tiver **pelo menos dois** dos seguintes:
- 3 ou mais variantes visuais distintas
- Estados próprios recorrentes (hover, active, disabled, selected)
- Usado em 3 ou mais contextos diferentes no layout
- Animação ou transição com valores específicos

Exemplos que **já qualificam:** `.goal-card`, `.section-menu-btn`, `.tx-status`

Exemplos que **não qualificam ainda:** `.kpi`, `.audit-pill`, `.note`

---

## 2. Primitive Tokens

Valores base. Nunca usados directamente em componentes — apenas como fonte para tokens semânticos.

### 2.1 Color Scale (OKLCH, dark-first)

```css
/* Gray scale — tintado para hue 264 (azul-acinzentado frio, alinhado com CMC) */
--primitive-gray-1000: oklch(5%  0.008 264);   /* deepest bg */
--primitive-gray-950:  oklch(8%  0.010 264);   /* page bg */
--primitive-gray-900:  oklch(12% 0.012 264);   /* card surface */
--primitive-gray-850:  oklch(16% 0.012 264);   /* card secondary */
--primitive-gray-800:  oklch(21% 0.014 264);   /* elevated surface */
--primitive-gray-700:  oklch(30% 0.014 264);   /* border / line */
--primitive-gray-600:  oklch(44% 0.012 264);   /* placeholder / disabled */
--primitive-gray-400:  oklch(62% 0.010 264);   /* muted text */
--primitive-gray-200:  oklch(82% 0.007 264);   /* secondary text */
--primitive-gray-100:  oklch(92% 0.005 264);   /* primary text */

/* Bitcoin Orange */
--primitive-orange-500: oklch(72% 0.18  55);   /* #f7931a — acento principal */
--primitive-orange-400: oklch(78% 0.16  55);   /* hover state */
--primitive-orange-600: oklch(64% 0.19  55);   /* pressed state */
--primitive-orange-900: oklch(22% 0.06  55);   /* bg tint subtil */

/* Status */
--primitive-green-500:  oklch(70% 0.18 145);   /* profit / ok */
--primitive-green-900:  oklch(20% 0.06 145);   /* bg tint ok */
--primitive-red-500:    oklch(62% 0.22  25);   /* loss / danger */
--primitive-red-900:    oklch(18% 0.07  25);   /* bg tint danger */
--primitive-amber-500:  oklch(75% 0.17  75);   /* warn */
--primitive-amber-900:  oklch(20% 0.06  75);   /* bg tint warn */

/* Pure endpoints (nunca usar directamente — apenas para sombras/overlays) */
--primitive-black: oklch(0%  0 0);
--primitive-white: oklch(100% 0 0);
```

### 2.2 Spacing Scale (4pt base)

```css
--primitive-space-1:  4px;
--primitive-space-2:  8px;
--primitive-space-3:  12px;
--primitive-space-4:  16px;
--primitive-space-6:  24px;
--primitive-space-8:  32px;
--primitive-space-12: 48px;
--primitive-space-16: 64px;
--primitive-space-24: 96px;
```

---

## 3. Semantic Tokens

Interface pública do sistema. São estes que `style.css` e os componentes consomem.

### 3.1 Surface Roles

```css
/* Backgrounds */
--color-bg-page:       var(--primitive-gray-950);   /* fundo do documento */
--color-bg-surface:    var(--primitive-gray-900);   /* card principal */
--color-bg-surface-2:  var(--primitive-gray-850);   /* card secundário / nested */
--color-bg-elevated:   var(--primitive-gray-800);   /* dropdown, tooltip, hover */
--color-bg-overlay:    oklch(5% 0.008 264 / 80%);  /* modal backdrop */
--color-bg-accent-subtle: var(--primitive-orange-900); /* tint BTC em backgrounds */

/* Borders */
--color-border:        var(--primitive-gray-700);   /* linha padrão */
--color-border-subtle: oklch(30% 0.014 264 / 40%); /* border subtil */
--color-border-accent: var(--primitive-orange-500); /* border de estado activo */
```

### 3.2 Text Roles

```css
--color-text-primary:   var(--primitive-gray-100);  /* texto principal */
--color-text-secondary: var(--primitive-gray-200);  /* texto secundário */
--color-text-muted:     var(--primitive-gray-400);  /* labels, metadata */
--color-text-disabled:  var(--primitive-gray-600);  /* disabled state */
--color-text-accent:    var(--primitive-orange-500); /* links, accent text */
--color-text-inverse:   var(--primitive-gray-950);  /* texto sobre fundo claro */
```

### 3.3 Interactive States

```css
/* Accent (Bitcoin Orange) */
--color-interactive-accent:         var(--primitive-orange-500);
--color-interactive-accent-hover:   var(--primitive-orange-400);
--color-interactive-accent-pressed: var(--primitive-orange-600);
--color-interactive-accent-subtle:  var(--primitive-orange-900);

/* Focus (acessibilidade — obrigatório) */
--color-focus-ring: var(--primitive-orange-500);
--focus-ring: 0 0 0 2px var(--color-bg-page), 0 0 0 4px var(--color-focus-ring);
```

### 3.4 Status Semantics

```css
/* Ok / Profit */
--color-status-ok:       var(--primitive-green-500);
--color-status-ok-bg:    var(--primitive-green-900);
--color-status-ok-text:  var(--primitive-green-500);

/* Warn */
--color-status-warn:     var(--primitive-amber-500);
--color-status-warn-bg:  var(--primitive-amber-900);
--color-status-warn-text: var(--primitive-amber-500);

/* Danger / Loss */
--color-status-danger:      var(--primitive-red-500);
--color-status-danger-bg:   var(--primitive-red-900);
--color-status-danger-text: var(--primitive-red-500);

/* Muted / Manual */
--color-status-muted:    var(--primitive-gray-700);
--color-status-muted-bg: var(--primitive-gray-850);
```

### 3.5 Spacing Semântico

```css
--space-xs:  var(--primitive-space-1);   /* 4px  — gap interno mínimo */
--space-sm:  var(--primitive-space-2);   /* 8px  — gap entre elementos relacionados */
--space-md:  var(--primitive-space-4);   /* 16px — padding padrão de card */
--space-lg:  var(--primitive-space-6);   /* 24px — separação entre secções */
--space-xl:  var(--primitive-space-8);   /* 32px — separação entre blocos maiores */
--space-2xl: var(--primitive-space-12);  /* 48px — margens de layout */
```

---

## 4. Typography Contract

### 4.1 Papéis

```css
--font-ui:   /* fonte para interface — selecção via /typeset seguindo impeccable */
--font-data: /* fonte mono para valores numéricos, TXID, código — selecção via /typeset */
--font-size-base: 14px;  /* base para app UI — rem relativo a isto */
```

**Regra**: a selecção de fontes específicas (`font-family` com nome) acontece em `css/tokens.css` após execução do processo de selecção definido no `impeccable` skill (font selection procedure). Não é decidida neste documento — este documento define o contrato de papéis.

### 4.2 Scale (fixed rem para app UI)

```css
--text-xs:   11px;   /* labels de metadata, timestamps */
--text-sm:   12px;   /* notas, muted, table cells secundários */
--text-base: 14px;   /* corpo, inputs, table cells */
--text-md:   16px;   /* valores KPI, títulos de card */
--text-lg:   18px;   /* valores KPI principais */
--text-xl:   24px;   /* não usar em app UI — reservado para landing */
```

### 4.3 Regras de Uso

- `--font-data` é obrigatório em: valores numéricos (sats, preço, P&L), TXID, timestamps
- `--font-ui` em todo o resto
- `font-variant-numeric: tabular-nums` obrigatório em qualquer coluna numérica alinhada
- Uppercase reservado para labels curtos (≤4 palavras) com `letter-spacing: 0.06em`
- Line-height em elementos com texto sobre fundo escuro: `+0.05` ao valor base (texto claro precisa mais respiração)

---

## 5. Motion Budget

### 5.1 Durações aprovadas

```css
--duration-instant: 80ms;   /* feedback imediato: toggle, check */
--duration-fast:   160ms;   /* hover states, small transitions */
--duration-base:   260ms;   /* a maioria das transições de estado */
--duration-slow:   400ms;   /* expansão de painéis, entrada de modais */
```

### 5.2 Easing aprovado

```css
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);   /* saídas e entradas — decelera naturalmente */
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1); /* transições de estado */
```

Bounce e elastic são proibidos. Objectos reais desaceleram.

### 5.3 Propriedades que NUNCA animam

`width`, `height`, `padding`, `margin`, `top`, `left`, `right`, `bottom`, `font-size`, `grid-template-columns`.

Animar apenas: `transform`, `opacity`, `color`, `background-color`, `border-color`, `box-shadow`.

Para altura: usar `grid-template-rows: 0fr → 1fr`.

### 5.4 `transition` proibido

```css
/* ❌ NUNCA */
transition: all 0.3s ease;

/* ✅ SEMPRE especificar */
transition: box-shadow var(--duration-fast) var(--ease-out),
            border-color var(--duration-fast) var(--ease-out);
```

---

## 6. Runtime Integration Contract

### 6.1 O problema

Chart.js renderiza em `<canvas>` — bypassa completamente o sistema de cascata CSS. Sem um contrato explícito, as cores dos datasets ficam hardcoded no JS, quebrando a fonte única de verdade.

### 6.2 Bridge: `js/ui/chart/tokens.js`

```js
// Módulo isolado. Lê tokens CSS em runtime. Nunca define valores primitivos.
const _root = document.documentElement;

export function readToken(name) {
  return getComputedStyle(_root).getPropertyValue(name).trim();
}

// Tokens que Chart.js consome — actualizados automaticamente se tokens.css mudar
export const chartTokens = {
  accent:    () => readToken('--color-interactive-accent'),
  textMuted: () => readToken('--color-text-muted'),
  border:    () => readToken('--color-border'),
  ok:        () => readToken('--color-status-ok'),
  danger:    () => readToken('--color-status-danger'),
  warn:      () => readToken('--color-status-warn'),
  bgSurface: () => readToken('--color-bg-surface'),
};
```

**Regra**: Nenhum ficheiro JS que constrói datasets ou opções de Chart.js define uma cor primitiva inline. Se a cor existe como token semântico, usa `chartTokens.X()`. Se não existe, cria o token primeiro em `tokens.css`.

### 6.3 Padrão de uso em datasets

```js
// ❌ NUNCA
datasets: [{ borderColor: '#f7931a' }]

// ✅ SEMPRE
import { chartTokens } from '../chart/tokens.js';
datasets: [{ borderColor: chartTokens.accent() }]
```

---

## 7. Migration Rules

### 7.1 Princípio: migração por toque

Não existe big bang. A migração segue o fluxo natural de trabalho:

> **Regra CSS:** Qualquer PR que edita um ficheiro CSS migra todos os hardcodes desse ficheiro para tokens semânticos antes de ser aprovado.
>
> **Regra JS:** Qualquer PR que edita ficheiros em `js/ui/` ou `js/services/` remove cores primitivas inline e usa `chartTokens` do bridge module (`js/ui/chart/tokens.js`).

Hardcodes em ficheiros não tocados não são tech debt imediato — são tech debt aceite até esse ficheiro ser editado.

### 7.2 O que pode permanecer hardcoded temporariamente

- Ficheiros CSS não tocados no PR actual
- Valores em `css/tokens.css` (são a fonte de verdade, podem ter literais)
- Comentários e documentação

### 7.3 O que deve sair primeiro (prioridade por impacto)

1. `:root` em `style.css` — substituído por `css/tokens.css` com tokens dark
2. `.kpi`, `.audit-pill`, `.glass-card` — maior visibilidade, mais hardcodes
3. `.msg` (mensagens de feedback) — usa gradientes com hex literais
4. Inline styles em `index.html` — migrar para classes
5. Cores hardcoded em datasets de Chart.js no JS

### 7.4 O que pode sobreviver como excepção declarada

- `css/tokens.css` — contém literais por definição
- SVG inline com `fill`/`stroke` declarados — caso a caso
- Third-party stylesheets (Chart.js defaults) — não são da nossa responsabilidade

---

## 8. Glass Card — Decisão de Arquitectura

O `.glass-card` **não é um pilar do sistema visual**. Não define a linguagem base de superfícies.

**Decisão:** Deprecar como uso geral. Permitir como excepção transitória em overlays flutuantes específicos (ex: `.chart-glass-inner`, `.live-chart`).

**Condições para sobreviver como excepção:**
- Remover `filter: url(#glass-distortion)` — SVG turbulence proibido
- Substituir `transition: all` por propriedades explícitas
- Declarar a excepção **no CSS**, na mesma linha do `backdrop-filter`: `/* glass-exception: <razão> */`
- Não aplicar a cards estáticos de conteúdo (`.kpi`, `.goal-card`, `.audit-pill`, etc.)

**Exemplo de declaração válida em CSS:**
```css
.chart-glass-inner {
  backdrop-filter: blur(6px); /* glass-exception: overlay flutuante do gráfico */
}
```

**Superfícies padrão do sistema** são opacas, com elevação via lightness diferencial OKLCH:
- `--color-bg-surface` (nível 1)
- `--color-bg-surface-2` (nível 2, levemente mais claro)
- `--color-bg-elevated` (nível 3, para dropdowns/tooltips)

---

## 9. Enforcement

### 9.1 Pre-commit hooks (primeira versão)

Regras grep que bloqueiam regressões estruturais:

```bash
# 1. Hex literal fora de tokens.css
# grep -rn produz "ficheiro:linha:conteúdo" — o -v precisa de corresponder a esse formato.
# Exclui tokens.css inteiro e linhas cujo conteúdo (a partir do segundo ':') seja comentário CSS.
grep -rn '#[0-9a-fA-F]\{3,8\}' css/ --include="*.css" \
  | grep -v '^css/tokens\.css:' \
  | grep -Pv ':\d+:\s*/[/*]' \
  && echo "❌ Hex literal fora de tokens.css" && exit 1

# 2. transition: all
grep -rn 'transition:\s*all' css/ --include="*.css" \
  && echo "❌ transition: all proibido — especificar propriedades" && exit 1

# 3. backdrop-filter sem declaração de excepção na mesma linha
# A excepção válida é um comentário /* glass-exception: ... */ na mesma linha.
grep -rn 'backdrop-filter' css/ --include="*.css" \
  | grep -v '/\* glass-exception' \
  && echo "❌ backdrop-filter sem /* glass-exception: <razão> */ na mesma linha" && exit 1

# 4. filter: url( (SVG distortion)
grep -rn 'filter:\s*url(' css/ --include="*.css" \
  && echo "❌ filter: url() proibido" && exit 1

# 5. Cores inline em HTML
grep -rn 'style="[^"]*color\s*:' index.html \
  && echo "❌ Cor inline em HTML — mover para classe CSS" && exit 1
```

> **Rule 5 scope note:** covers `color`, `background-color`, `border-color` and similar color properties in inline styles. Structural inline styles (`display`, `padding`, `margin`, etc.) are separate tech debt tracked outside this enforcement contract.

### 9.2 Review checklist (PR manual)

Antes de aprovar qualquer PR que toca CSS ou HTML:

- [ ] Nenhum hex literal fora de `css/tokens.css`
- [ ] Nenhum `transition: all`
- [ ] Nenhum `backdrop-filter` sem comentário `glass-exception`
- [ ] Nenhum `filter: url(`
- [ ] Tokens semânticos usados — não primitivos directamente em componentes
- [ ] Focus visible testado (Tab navigation no browser)
- [ ] Touch targets ≥ 44×44px em elementos interactivos novos

---

## Apêndice: Decisões Rejeitadas

| Decisão | Alternativa considerada | Razão da rejeição |
|---|---|---|
| JS como SoT (tokens em JS, CSS derivado) | CSS como SoT | Desloca duplicação sem resolver. Introduz pipeline sem benefício real. |
| Style Dictionary / W3C tokens JSON | CSS custom properties directo | Over-engineering para projecto sem bundler e uso solo |
| Três camadas de tokens desde o início | Duas camadas + opt-in | Terceira camada global é prematura; critério de promoção documentado é suficiente |
| Formalizar glassmorphism como superfície padrão | Deprecar como pilar | Gera dívida, não é pilar da identidade declarada (heavy/premium/dark) |
| Migração big bang | Migração por toque | Interrompe fluxo de trabalho, risco alto, sem ganho de qualidade adicional |
