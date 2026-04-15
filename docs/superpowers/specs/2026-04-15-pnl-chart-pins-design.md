# Design: P&L em Tempo Real + Alfinetes no Gráfico

**Data:** 2026-04-15
**Status:** Aprovado
**Milestone sugerido:** M4-A (após M3-B goals)

---

## Visão Geral

Adicionar ao btc-journal-structured três capacidades interligadas:

1. **Preço BTC em tempo real** — polling a cada 30s via CoinGecko
2. **P&L por aporte** — coluna na tabela com valor atual, lucro/perda em $ e %, estilo financeiro dinâmico
3. **Alfinetes no gráfico** — pontos clicáveis no gráfico de preço histórico, um por aporte, com modal de detalhes

---

## Abordagem

Incremental por camadas, na ordem abaixo. Cada camada é entregável e testável de forma isolada antes de avançar.

---

## Camada 1 — `js/services/price-service.js` (novo)

Módulo independente responsável por manter o preço BTC atual cacheado por moeda (`vs`).

**API pública:**

| Função | Descrição |
|---|---|
| `startPolling(vs)` | Inicia polling para a moeda informada (`usd`/`brl`). Reinicia se `vs` mudar. |
| `stopPolling()` | Para o polling ativo. |
| `getCurrentPrice(vs)` | Retorna o último preço cacheado para a moeda informada. |
| `onPriceUpdate(fn)` | Registra listener chamado com `{ vs, price, time }` a cada atualização. Retorna função de unsubscribe. |

**Comportamento:**
- Busca imediata ao iniciar (sem esperar 30s)
- Cache em memória por moeda
- Se `startPolling(vs)` for chamado com moeda diferente da atual, interrompe o polling anterior e reinicia com a nova moeda — sem polling duplo
- Em caso de falha na API, reutiliza o último cache disponível para aquela moeda — nunca quebra a UI
- Fonte: CoinGecko (já integrada no app)

---

## Camada 2 — Expansão de `js/core/calculations.js`

Nova função pura de P&L (sem efeitos colaterais):

```js
calcEntryPnL(entry, currentPrice)
// retorna: { currentValue, pnlValue, pnlPct, isProfit }
```

**Lógica de cálculo:**
```
valor atual = (entry.sats / 1e8) * currentPrice
pnl $       = valor atual - entry.fiatAmount
pnl %       = (pnl $ / entry.fiatAmount) * 100
isProfit    = pnl $ > 0  (qualquer centavo positivo = verde)
```

> Formatação para exibição fica em `js/ui/table/helpers.js` — core calcula, UI formata.

---

## Camada 3 — Coluna P&L na Tabela

Nova coluna "P&L" adicionada à tabela existente (`js/ui/table/`).

**Conteúdo por linha:**
```
$ 124,50   ▲ +55,6%    ← verde
$ 61,20    ▼ -23,5%    ← vermelho
```

**Estilo visual (inspirado em apps financeiros — Binance, TradingView):**
- Valores monetários em fonte monospace
- `+` / `-` explícito antes da porcentagem
- Seta ▲ (lucro) ou ▼ (perda)
- Transição suave de cor ao atualizar (CSS transition)
- Verde para qualquer lucro, vermelho para qualquer perda, mesmo $0,01 de diferença
- Atualização automática a cada 30s via listener do `price-service`

---

## Camada 4 — Alfinetes no Gráfico

**Implementação com Chart.js:**
- Dataset extra "aportes" sobreposto ao gráfico de preço histórico
- Cada ponto posicionado em `x = data do aporte`, `y = entry.btcPrice` (preço já salvo no aporte)
- Não haverá busca adicional de preço histórico nesta subfase
- Estilo: círculo com borda branca, preenchimento neutro (discreto, não polui o gráfico)

**Interação:**
- Clique no alfinete abre modal leve (sem framework externo)

**Modal de detalhes:**
```
┌─────────────────────────────┐
│  Aporte — 15 Jan 2025       │
│                             │
│  Sats        150.000 sats   │
│  Custo       $ 80,00        │
│  Hoje        $ 124,50       │
│  P&L         ▲ +55,6%       │
└─────────────────────────────┘
```

---

## Enriquecimento por TXID

Quando um TXID é validado com sucesso via `txid-service.js`:

- O campo `confirmed_at` (timestamp do bloco) sobrescreve `entry.date`
- O alfinete no gráfico se move no eixo X para a data on-chain
- A data exibida na tabela e no modal passa a ser a data on-chain
- O eixo Y do alfinete continua baseado no `entry.btcPrice` já salvo nesta subfase

A blockchain é a fonte de verdade para a **data**. O preço histórico na data on-chain é fora de escopo por ora.

---

## Dados que o TXID provê (via mempool.space)

| Campo | Uso |
|---|---|
| `confirmed_at` | Sobrescreve `entry.date` |
| `confirmations` | Exibido na auditoria |
| `fee` (sats) | Disponível para exibição futura |
| `block_height` | Referência interna |

---

## Arquivos Afetados

| Arquivo | Ação |
|---|---|
| `js/services/price-service.js` | Criar |
| `js/core/calculations.js` | Adicionar `calcEntryPnL` |
| `js/ui/table/render.js` | Adicionar coluna P&L |
| `js/ui/table/helpers.js` | Helpers de formatação de P&L e apresentação financeira |
| `js/app.js` | Integrar `price-service`, passar preço para tabela e gráfico |
| `js/services/txid-service.js` | Extrair e retornar `confirmed_at` |
| `css/style.css` | Estilos da coluna P&L e modal |
| `tests/` | Testes para `price-service` e `calcEntryPnL` |

---

## Fora de Escopo (por hora)

- Agrupamento mensal em cards (definido como futuro)
- Fee exibida no modal
- Histórico de preço BTC na data do aporte (requer endpoint separado)

---

## Critérios de Conclusão

- [ ] `price-service` com polling, cache e listeners funcionando
- [ ] `calcEntryPnL` com testes unitários
- [ ] Coluna P&L na tabela atualizando a cada 30s
- [ ] Alfinetes visíveis no gráfico para todos os aportes
- [ ] Modal abrindo ao clicar com dados corretos
- [ ] Data on-chain substituindo data manual após validação de TXID
- [ ] CI verde
