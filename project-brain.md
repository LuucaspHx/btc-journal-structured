# BTC Journal - Project Brain

## ⚖️ Regra de Ouro para Agentes

**Estado técnico = filesystem + git. Brain = decisões + contexto. Nunca ao contrário.**

- Verificar filesystem antes de reportar qualquer estado
- Ver `docs/DEFINITION_OF_DONE.md` antes de fechar qualquer milestone
- Repo canónico: `/Users/lucas_phx/Documents/btc-journal-structured`

## Visao geral
- Aplicacao web estatica (SPA) para registrar aportes em Bitcoin, acompanhar custo medio, lucro/prejuizo, auditoria de TXIDs e metas em sats.
- Nao existe backend nem banco remoto. O estado principal vive no `localStorage` do navegador.
- O projeto depende de APIs publicas no cliente:
  - CoinGecko para preco atual, historico e OHLC.
  - mempool.space para validar TXIDs on-chain.
- O codigo esta parcialmente modularizado, mas `js/app.js` ainda concentra quase todo o runtime da UI.

## Mapa mental rapido de Git para este projeto
- `working tree`: seus arquivos locais agora.
- `branch`: uma linha de trabalho. Ex.: feature nova, refactor, correcao.
- `commit`: um checkpoint nomeado da branch.
- `push`: envia os commits locais para o GitHub.
- `pull request (PR)`: pedido para revisar e integrar uma branch em outra.
- `merge`: incorporacao final da branch no destino.

Fluxo basico que voce vai repetir:
1. `git status` - ver o que mudou.
2. `git switch -c nome-da-branch` - criar uma branch nova quando necessario.
3. `git add <arquivos>` - escolher o que entra no commit.
4. `git commit -m "mensagem clara"` - salvar checkpoint.
5. `git push -u origin nome-da-branch` - publicar no GitHub.
6. Abrir PR da branch publicada para a branch de destino.

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

## Estado persistido
Chave principal:

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

Observacoes importantes:
- O storage canonico usa `btc_journal_state_v3`.
- O legado observado pelo app e `btcJournalV1`.
- Backups de migracao/import sao gravados com chaves derivadas no proprio `localStorage`.
- Entradas antigas podem chegar em shape legado (`price`, `fiat`); o runtime tenta canonizar para `btcPrice` e `fiatAmount`.

## Shape canonico das transacoes
Campos mais importantes de cada `tx`:
- identificacao: `id`, `schemaVersion`, `createdAt`, `updatedAt`
- valores: `sats`, `btcAmount`, `btcPrice`, `fiatAmount`, `fee`, `fiatCurrency`
- classificacao: `type`, `exchange`, `strategy`, `tags`, `note`
- prova on-chain: `txid`, `wallet`, `status`, `validation`

Invariantes praticos:
- novas entradas devem passar por `validateTransaction()`
- shape final deve passar por `createDefaultEntry()` ou `ensureCanonicalEntry()`
- `tags` sao deduplicadas e limitadas
- `strategy` e texto livre, usado tambem nas metas

## Superficies da UI
- Topbar com moeda, ano, modo do grafico, limpar dados e acesso ao grafico expandido.
- Formulario principal para criar/editar aportes, incluindo strategy, tags, TXID e wallet.
- Filtros por data, sats, preco, tipo, busca textual e ordenacao.
- Tabela de transacoes com acoes de editar/remover/validar.
- KPIs de investido, sats, preco medio, valor atual e P/L.
- Painel de auditoria com distribuicao por status, filtros e agrupamentos por wallet, exchange e strategy.
- Painel de metas com modal, presets, filtros por strategy/tags e detalhe das entradas que contam para a meta.
- Exportacao em JSON e CSV; importacao com pre-visualizacao e migracao de formatos antigos.
- Grafico principal e grafico live.

## Modulos e responsabilidades
- `js/core/schema.js`
  - define `SCHEMA_VERSION`
  - cria a entrada canonica
  - aplica defaults para tipo, moeda, tags, datas e IDs
- `js/core/calculations.js`
  - calcula sats a partir de fiat/preco
  - converte sats para BTC
  - calcula preco medio com fee
- `js/core/validators.js`
  - valida payload do formulario
  - reexporta normalizacao/sanitizacao do import
- `js/import-sanitizer.js`
  - aceita arrays, `{ entries }` e `{ txs }`
  - limpa numeros, datas, tipos e campos textuais
  - ainda trabalha em shape legado/minimo
- `js/ui/import-export/helpers.js`
  - normaliza shapes de import
  - prepara payload a partir de texto JSON/legado
  - protege CSV contra injection basica
- `js/ui/import-export/render.js`
  - renderiza preview de exportacao
  - renderiza preview de importacao
  - abre/fecha modais de import/export
- `js/ui/import-export/bind.js`
  - concentra listeners do fluxo de import/export
  - usa callbacks para evitar ciclo com o `app.js`
  - expoe cleanup para futuro rebind/hot-reload
- `js/storage/local-db.js`
  - load/save do estado
  - backup/listagem/restauro de snapshots no `localStorage`
- `js/storage/migrations.js`
  - detecta `btcJournalV1`
  - converte payload antigo para `{ txs: [...] }`
- `js/services/txid-service.js`
  - resolve rede
  - monta URL do explorer
  - consulta transacao
  - decide entre `manual`, `pending`, `confirmed`, `invalid`, `mismatch`, `inconclusive`
- `js/core/audit.js`
  - agrega totais e percentuais de prova
  - ordena prioridade para auditoria
- `js/core/goals.js`
  - normaliza metas
  - calcula progresso
  - filtra entradas que contam para cada meta
  - gera catalogos de strategy/tags
- `js/features/goals-controller.js`
  - mantem metas ativas
  - recalcula progresso quando metas ou entradas mudam
  - expõe snapshot pronto para a UI

## Dependencias externas
- `Chart.js` via CDN no HTML.
- `date-fns` e adapter de Chart.js via CDN.
- `jest` para testes locais.
- APIs publicas:
  - CoinGecko
  - mempool.space

## Testes existentes
Suite local validada em 2026-04-12 com `npm test`:
- 11 suites ok
- 60 testes ok

Cobertura funcional atual:
- `tests/core-schema.test.js`: shape canonico e defaults
- `tests/core-calculations.test.js`: sats/BTC/preco medio
- `tests/core-validators.test.js`: validacao e ponte de import
- `tests/import-sanitizer.test.js`: sanitizacao de payloads importados
- `tests/import-export-helpers.test.js`: helpers de import/export
- `tests/storage-local.test.js`: load/save/backups
- `tests/migrations.test.js`: migracao do legado
- `tests/txid-service.test.js`: validacao de TXID e redes
- `tests/core-audit.test.js`: metricas de auditoria
- `tests/core-goals.test.js`: metas, filtros e catalogos
- `tests/goals-controller.test.js`: controlador de metas

Observacao:
- Ha um `console.error` esperado no teste de erro da migracao invalida; isso nao derruba a suite.

## Riscos e debito tecnico
- `js/app.js` esta grande demais e mistura dominio, DOM, fetch, persistencia e renderizacao. E o principal ponto de manutencao dificil.
- `import-sanitizer.js` ainda opera com shape antigo/minimo, e o runtime precisa reconciliar isso depois com `ensureCanonicalEntry()`.
- Como tudo roda no browser, falhas de rede nas APIs externas afetam UX e podem parecer bugs locais.
- Persistencia apenas em `localStorage` significa risco de perda de dados se o usuario limpar o navegador sem exportar backup.
- Migracoes precisam manter muito cuidado para nao sobrescrever estado atual sem backup.

## Regras operacionais
- Antes de alterar storage/schema, revisar `createDefaultEntry()`, `ensureCanonicalEntry()` e `saveState()`.
- Antes de mexer em importacao, revisar tambem `sanitizeImportPayload()`, `normalizeImportShape()` e `migrateV1ToV3()`.
- Antes de mexer em TXID/auditoria, revisar `validateTxidEntry()` e `computeAuditMetrics()`.
- Rodar `npm test` a cada rodada relevante.
- Para validar a UI localmente: `python3 -m http.server 8000` e abrir `http://localhost:8000`.

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

## Cadencia documental e snapshots
- `project-brain.md` e memoria viva; atualizar quando houver:
  - mudanca relevante de arquitetura
  - fechamento de etapa importante
  - mudanca de prioridade
  - novo risco relevante
- `docs/architecture-map.md` deve refletir a estrutura tecnica atual e ser atualizado quando houver mudanca real de camadas/modulos.
- `docs/refactor-playbook.md` e o processo oficial e muda com baixa frequencia.
- ZIP so deve ser gerado em milestone/snapshot estavel, nunca em microetapa.
- Um ZIP de revisao tecnica deve representar estado validado, nao apenas estado salvo.

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

## Estado atual

> Ver `git log --oneline` para estado técnico atual. Este documento não declara o que está feito — o git é a fonte de verdade.

Funcionalidades presentes no código (verificar com `git ls-files js/`):
- Registro e edição de aportes
- Filtros, dashboard e gráficos
- Persistência local versionada (schema v3)
- Import/export com preview
- Migração legado → v3
- Validação de TXID on-chain
- Metas em sats com strategy/tags
- UI modularizada: `ui/table/*`, `ui/import-export/*`, `ui/audit/*`

## Próximo passo

Próximo marco de produto: **M3-B** — separação do domínio de metas (goals).
Aplicar o mesmo protocolo de recorte controlado com DoD em `docs/DEFINITION_OF_DONE.md`.
