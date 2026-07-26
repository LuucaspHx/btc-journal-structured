# BTC Journal - Architecture Map

Atualizado em 2026-07-26.

## Visao geral

- SPA estatica, sem backend ou bundler.
- `index.html` define o shell e os contratos DOM.
- `js/app.js` e a composition root e ainda concentra parte relevante do runtime.
- `localStorage` guarda o estado canonico em `btc_journal_state_v3`.
- CoinGecko fornece preco/historico/OHLC; mempool.space valida TXIDs.
- A mesma engine alimenta desktop e mobile. Viewport altera apresentacao, nunca estado ou regra de negocio.

## Camadas atuais

### Shell e design system

- `index.html`
- `css/tokens.css`
- `css/style.css`

Responsabilidade: estrutura da SPA, IDs consumidos pelos binders, tokens semanticos, layout e adaptacao responsiva. Tabelas densas ficam em regioes de scroll internas para nao expandir o documento.

### Composition root

- `js/app.js`

Responsabilidade: boot, estado em memoria, persistencia, lifecycle do Chart.js e coordenacao entre modulos. Com 3458 linhas, continua sendo o principal hotspot; novos dominios nao devem ser implementados diretamente nele quando puderem entrar por contratos testaveis.

### Dominio puro

- `js/core/schema.js`
- `js/core/calculations.js`
- `js/core/portfolio.js`
- `js/core/validators.js`
- `js/core/audit.js`
- `js/core/goals.js`

Regra: sem DOM, fetch ou `localStorage`. `computePortfolioSummary()` e o contrato agregado compartilhado; consumidores nao devem recalcular portfolio na UI.

### Controladores e read models de feature

- `js/features/goals-controller.js`
- futuro `js/features/dashboard-model.js`

Responsabilidade: compor snapshots e regras puras para consumo da UI. Nao cria um segundo store; recebe o estado canonico e devolve modelos derivados.

### Infraestrutura

- `js/storage/local-db.js`
- `js/storage/migrations.js`
- `js/import-sanitizer.js`
- `js/services/http.js`
- `js/services/retry-policy.js`
- `js/services/price-service.js`
- `js/services/txid-service.js`

Responsabilidade: persistencia, compatibilidade de dados, rede, timeout/abort, backoff e integracoes externas.

### UI modular

- `js/ui/section-nav.js` — binder e API publica `activateSection()`
- `js/ui/table/{helpers,render,bind}.js`
- `js/ui/audit/{helpers,render,bind}.js`
- `js/ui/import-export/{helpers,render,bind}.js`
- `js/ui/chart/{helpers,config,crosshair,tokens,bind}.js`

Padrao: `helpers` mantem logica pura, `render` escreve no DOM, `bind` registra eventos por callbacks e `app.js` coordena. O lifecycle final do Chart.js ainda vive em `app.js`.

## Fluxo de dados

1. `boot()` carrega e migra o estado persistido.
2. Entradas passam por validacao, normalizacao e canonizacao.
3. Mutacoes salvam o mesmo estado em `btc_journal_state_v3`.
4. `renderAll()` e subscriptions atualizam as superficies derivadas.
5. Servicos externos atualizam preco, grafico e validacao on-chain sem substituir o estado canonico.
6. Export/import preserva transacoes, moeda e metas.

## Invariantes

- `SCHEMA_VERSION = 3` e `btc_journal_state_v3` permanecem fontes de verdade.
- Desktop e mobile compartilham engine, comandos e modelos.
- A Main Page futura representa o portfolio completo, independente dos filtros da tabela.
- Nenhum modulo de UI persiste estado de dominio por conta propria.
- Migracoes e imports preservam backup e compatibilidade.
- Pins, crosshair, OHLC e target price fazem parte do contrato atual do grafico.

## Qualidade e entrega

- Jest cobre dominio, storage, services e helpers: `npm test`.
- Playwright executa a SPA real em seis viewports: `npm run test:e2e`.
- O smoke responsivo verifica todas as secoes, overflow global, erros de runtime e alvos tacteis em mobile.
- O CI instala Chromium e executa Jest + Playwright.
- O deploy de Pages publica apenas o `dist/` minimo.

## Hotspots

1. `js/app.js`: estado, DOM e lifecycle ainda muito concentrados.
2. Importacao/migracao: qualquer alteracao pode afetar dados existentes.
3. Grafico: combina rede, canvas, estado e plugins.
4. Semantica de fees: P&L por linha e agregado possuem contratos historicos diferentes.
5. `localStorage`: requer export/backup para mitigar perda local.

## Roadmap arquitetural

1. Manter gates Jest, tokens, lint e Playwright verdes.
2. Inventariar o prototipo externo antes de moldar a Main Page.
3. Expor comandos e navegacao por APIs compartilhadas, sem store paralelo.
4. Criar `dashboard-model.js` como read model puro sobre portfolio, metas e preco.
5. Entregar cada fatia vertical com desktop e mobile no mesmo PR.
6. Integrar o grafico existente sem perder plugins ou lifecycle.
7. Reduzir `app.js` por extracoes pequenas, caracterizadas e reversiveis.

## Fora de escopo imediato

- framework ou bundler novo
- backend remoto
- troca da chave/schema de storage
- segundo aplicativo mobile
- reescrita total do runtime
