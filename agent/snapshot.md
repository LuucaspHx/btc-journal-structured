# Agent Snapshot

Gerado em: 2026-04-12 03:30:47 WEST

## Workspace
- CWD: `/Users/lucas_phx/Documents/btc-journal-structured`
- Branch: `feat/nova-funcionalidade`

## Git Head
59334dd Merge pull request #1 from LuucaspHx/feat/ui-tesla-apple-gray
78a2485 feat(ui): aplicar tema Tesla-Apple-Gray e ajustes de segurança
0db7e97 feat(ui): add non-blocking banners, confirm modal, chart polish, undo delete
6bea1f1 chore: proteger copilot-instructions.md via .gitignore
8de052d chore: remover copilot-instructions.md por conter dados sensíveis

## JS Inventory
./coverage/lcov-report/block-navigation.js
./coverage/lcov-report/prettify.js
./coverage/lcov-report/sorter.js
./js/app.js
./js/core/audit.js
./js/core/calculations.js
./js/core/goals.js
./js/core/schema.js
./js/core/validators.js
./js/features/goals-controller.js
./js/import-sanitizer.js
./js/services/txid-service.js
./js/storage/local-db.js
./js/storage/migrations.js
./js/ui/import-export/bind.js
./js/ui/import-export/helpers.js
./js/ui/import-export/render.js
./js/ui/table/bind.js
./js/ui/table/helpers.js
./js/ui/table/render.js
./tests/core-audit.test.js
./tests/core-calculations.test.js
./tests/core-goals.test.js
./tests/core-schema.test.js
./tests/core-validators.test.js
./tests/goals-controller.test.js
./tests/helpers/localStorageMock.js
./tests/import-export-helpers.test.js
./tests/import-sanitizer.test.js
./tests/migrations.test.js
./tests/storage-local.test.js
./tests/txid-service.test.js

## Project Brain: Arquitetura Atual
## Arquitetura atual
- `index.html` e o shell principal da SPA.
- `css/style.css` define o visual, layout, modais, cards, auditoria, metas e grafico.
- `js/app.js` faz boot, bind de eventos, renderizacao, persistencia, import/export, filtros, metas, auditoria e integracoes externas.
- `js/core/*` concentra regras puras de negocio:
  - `schema.js`: shape canonico da transacao e `SCHEMA_VERSION = 3`.
  - `calculations.js`: conversoes BTC/sats e preco medio.
  - `validators.js`: validacao de formulario e ponte para sanitizacao de import.
  - `goals.js`: metas em sats, filtros por strategy/tags e catalogos.
  - `audit.js`: metricas de auditoria e prioridade por status.
- `js/ui/import-export/*` agora separa o fluxo de import/export em helpers, render e bind, mantendo a orquestracao no `js/app.js`.
- `js/storage/*` cuida do `localStorage` e da migracao do legado.
- `js/services/txid-service.js` valida TXIDs contra o explorer.
- `js/features/goals-controller.js` controla metas, progresso e catalogos.
- `js/import-sanitizer.js` normaliza imports legados e formatos externos.
- `planilha.html` parece ser uma versao/experimento antigo; o botao correspondente na UI principal esta desativado.


## Project Brain: Fluxo Real da Aplicacao
## Fluxo real da aplicacao
1. `boot()` carrega estado salvo, hidrata metas, restaura modo do grafico e tenta detectar migracao de `btcJournalV1`.
2. O formulario de aporte valida dados com `validateTransaction()`, normaliza com `normalizeEntry()` e converte para shape canonico com `createEntryFromNormalized()`.
3. O estado e salvo em `btc_journal_state_v3` via `saveState()`.
4. A UI renderiza:
  - KPIs principais
  - filtros
  - tabela de transacoes
  - grafico historico
  - painel de auditoria
  - painel de metas
5. Se houver TXID, o app agenda validacao automatica contra mempool.space.
6. Export/import preserva transacoes, moeda selecionada e metas.


## Project Brain: Processo Oficial
## Processo oficial
- O processo operacional oficial agora esta documentado em `docs/refactor-playbook.md`.
- O mapa tecnico de apoio esta em `docs/architecture-map.md`.
- Regra de execucao:
  - um dominio por vez
  - uma etapa por vez
  - um commit por etapa
  - `git diff --stat` antes de commitar
  - `npm test` obrigatorio por etapa relevante
- Nenhuma feature nova de medio/grande porte que aumente o acoplamento do runtime principal entra antes de o runtime principal estar sob controle.


## Project Brain: Proximo Passo Recomendado
## Proximo passo recomendado
- Prioridade tecnica imediata: usar o processo oficial para quebrar `js/app.js` em modulos menores por dominio:
  - `ui/form`
  - `ui/table`
  - `ui/chart`
  - `ui/import-export`
  - `ui/audit`
  - `ui/goals`
- Ordem oficial do refactor:
  1. helpers
  2. render
  3. binders
  4. `app-state`
  5. `app.js` como orquestrador
- Estado atual do M1:
  - Etapa 1A (`ui/table/helpers`) encerrada no codigo atual.
  - Etapa 2A (`ui/table/render`) encerrada.
  - Etapa 3B (`ui/table/bind`) encerrada com smoke manual aprovado.
- O Milestone M1 foi encerrado com o dominio de tabela/filtros separado em helpers, render e bind.
- Estado atual do M2:
  - Etapa 1B (`ui/import-export/helpers`) encerrada.
  - Etapa 2B (`ui/import-export/render`) encerrada no codigo atual.
  - Etapa 3C (`ui/import-export/bind`) encerrada no codigo atual.
- O dominio de import/export agora esta separado em helpers, render e bind, mantendo parsing, canonizacao e atualizacao de estado no `js/app.js`.
- O fechamento formal do M2 ainda depende de smoke manual curto do modal de exportacao/importacao.
- O proximo marco recomendado apos o smoke do M2 e separar o painel de auditoria/TXID em `ui/audit/*`.
- Prioridade funcional: continuar usando `strategy` e `tags` para insights, filtros rapidos e visualizacoes.
- Prioridade de seguranca operacional: reforcar o fluxo de backup/export antes de migracoes ou imports destrutivos.


## Project Brain: Estado Atual
## Estado atual
- O projeto local esta funcional e com testes verdes.
- A aplicacao ja cobre:
  - registro e edicao de aportes
  - filtros e dashboard
  - persistencia local versionada
  - import/export
  - migracao legado -> v3
  - auditoria de TXID
  - metas em sats com strategy/tags
  - graficos historicos e live
- O maior gargalo agora nao e falta de funcionalidade, e sim organizacao/manutenibilidade do runtime principal.
- A partir de 2026-04-05, o projeto passa a ter processo oficial documentado em `docs/`, com separacao entre memoria viva (`project-brain.md`) e snapshot de medio prazo (ZIP por milestone).
- O Milestone M1 esta refletido no runtime atual com tabela/filtros separados em `js/ui/table/helpers.js`, `js/ui/table/render.js` e `js/ui/table/bind.js`.
- O Milestone M2 esta refletido no runtime atual com import/export separados em `js/ui/import-export/helpers.js`, `js/ui/import-export/render.js` e `js/ui/import-export/bind.js`.
- O `js/app.js` continua como hotspot, mas agora com menos acoplamento nos dominios de tabela/filtros e import/export.


## Project Brain: Proximo Passo Operacional
## Proximo passo operacional
- Concluir o smoke manual curto do dominio de import/export para encerrar formalmente o M2.
- Validacao minima esperada:
  - `npm test`
  - smoke manual curto do modal de exportacao/importacao
  - verificacao de escopo no diff
- Proximo passo tecnico apos o smoke:
  - iniciar a separacao do painel de auditoria/TXID em `ui/audit/*`
