# BTC Journal - Architecture Map

Atualizado em 2026-04-05.

## Objetivo
- Dar uma leitura curta da arquitetura atual.
- Identificar o que e runtime, o que e dominio, o que e infraestrutura e o que e divida tecnica.
- Servir de apoio para o refactor do `js/app.js`.

## Visao geral do sistema
- Aplicacao SPA estatica, sem backend.
- Entrada principal: `index.html`.
- Runtime principal: `js/app.js`.
- Persistencia local: `localStorage`.
- Integracoes externas:
  - CoinGecko para preco atual, historico e OHLC
  - mempool.space para validacao de TXID

## Camadas atuais

### 1. Shell e layout
- `index.html`
- `css/style.css`

Responsabilidade:
- estrutura visual da SPA
- modais
- containers e IDs usados pelo runtime
- carga de dependencias CDN

Observacao:
- o HTML esta fortemente acoplado ao `js/app.js` por IDs e elementos de interface.

### 2. Runtime principal
- `js/app.js`

Responsabilidade:
- boot da aplicacao
- bind de eventos
- controle de estado em memoria
- renderizacao da UI
- import/export
- orquestracao de auditoria, metas e grafico
- fetch para APIs externas

Observacao:
- hoje e o principal hotspot tecnico do projeto.

### 3. Dominio puro
- `js/core/schema.js`
- `js/core/calculations.js`
- `js/core/validators.js`
- `js/core/audit.js`
- `js/core/goals.js`

Responsabilidade:
- shape canonico
- calculos
- validacoes
- metricas de auditoria
- metas e progresso

Regra:
- esta camada deve permanecer sem DOM, sem `localStorage` e sem fetch.

### 4. Infraestrutura e integracao
- `js/storage/local-db.js`
- `js/storage/migrations.js`
- `js/services/txid-service.js`
- `js/import-sanitizer.js`

Responsabilidade:
- persistencia local
- migracao legado -> v3
- traducao de payloads importados
- acesso ao explorer

### 5. Controladores de feature
- `js/features/goals-controller.js`

Responsabilidade:
- coordenar goals state
- recalcular progresso
- expor snapshot para a UI

### 6. Modularizacao iniciada
- `js/ui/table/helpers.js`

Responsabilidade:
- primeiro bloco extraido do monolito para o dominio de tabela/transacao

Observacao:
- a arquitetura alvo pede mais modulos em `js/ui/*`, mas isso ainda nao aconteceu.

## Fluxo principal de dados
1. Usuario interage com `index.html`.
2. `js/app.js` coleta inputs e valida payload.
3. Entrada e normalizada e canonizada.
4. Estado e salvo em `btc_journal_state_v3`.
5. UI e re-renderizada.
6. Se houver TXID, a validacao on-chain pode ser executada.
7. Metas e auditoria usam o mesmo estado para computar visoes derivadas.

## Estado persistido
Shape principal esperado:

```json
{
  "txs": [],
  "goals": {
    "list": [],
    "activeGoalId": null,
    "lastComputedAt": null
  },
  "vs": "usd"
}
```

## Invariantes arquiteturais
- `SCHEMA_VERSION` continua sendo a fonte de verdade do schema.
- `localStorage` continua usando `btc_journal_state_v3`.
- Import/export nao pode mudar shape sem tarefa explicita.
- Migracao do legado precisa continuar suportada.
- Logica de TXID e auditoria nao deve sair de modulos de dominio/servico para a UI.

## Hotspots

### Hotspot 1 - `js/app.js`
- mistura dominio, DOM, fetch, persistencia e render
- custo de mudanca alto
- risco de regressao transversal

### Hotspot 2 - importacao e migracao
- `js/import-sanitizer.js`
- `js/storage/migrations.js`
- `js/storage/local-db.js`

Motivo:
- qualquer erro aqui afeta compatibilidade dos dados

### Hotspot 3 - grafico
- parte do `js/app.js` ligada a fetch, serie historica, OHLC e render

Motivo:
- depende de APIs externas, estado e canvas ao mesmo tempo

## Arquitetura alvo

### Camada 1 - dominio puro
- `js/core/*`

### Camada 2 - infraestrutura
- `js/storage/*`
- `js/services/*`
- `js/import-sanitizer.js` ou modulo equivalente de adaptacao

### Camada 3 - estado
- futuro `js/state/app-state.js`

### Camada 4 - UI por dominio
- `js/ui/form/*`
- `js/ui/table/*`
- `js/ui/import-export/*`
- `js/ui/audit/*`
- `js/ui/goals/*`
- `js/ui/chart/*`

### Camada 5 - composicao
- `js/app.js`

## Ordem de refactor recomendada
1. helpers puros
2. renderizadores
3. binders
4. estado compartilhado
5. `js/app.js` como orquestrador

## O que nao e prioridade agora
- reescrever schema
- trocar persistencia
- trocar APIs externas
- introduzir bundler/framework
- adicionar features grandes antes de reduzir o custo do runtime principal
