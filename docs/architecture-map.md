# BTC Journal — mapa de arquitetura

Este mapa descreve o runtime observado. O código e os testes prevalecem se houver divergência.

## Contexto

A aplicação é uma SPA estática, sem backend ou bundler. `index.html` inicia o shell; o estado canônico fica em `localStorage`. CoinGecko fornece preços e mempool.space valida TXIDs. Chart.js e utilitários de data são carregados por CDN.

## Camadas

| Camada | Arquivos principais | Responsabilidade |
| --- | --- | --- |
| Shell e estilo | `index.html`, `css/tokens.css`, `css/style.css` | Estrutura, contratos DOM, tokens e layout responsivo |
| Composition root | `js/app.js` | Boot, estado em memória, coordenação, persistência e ciclo do gráfico |
| Domínio puro | `js/core/*` | Schema, cálculos, portfolio, validação, auditoria e metas |
| Features | `js/features/*` | Comandos e controladores que compõem snapshots para a UI |
| Infraestrutura | `js/storage/*`, `js/services/*`, `js/import-sanitizer.js` | Storage, migração, rede, retry, preços, TXID e importação |
| UI modular | `js/ui/*` | Helpers puros, renderização e bind de eventos |

Módulos de domínio não devem depender de DOM, `fetch` ou `localStorage`. Módulos de UI não devem persistir um estado paralelo.

## Fluxos críticos

### Boot e persistência

1. `boot()` carrega `btc_journal_state_v3`.
2. O runtime detecta e tenta migrar `btcJournalV1` quando aplicável.
3. Entradas passam por validação, normalização e canonização.
4. Uma mutação é persistida antes de ser publicada aos controladores e à UI.
5. `renderAll()` atualiza as superfícies derivadas.

### Importação e migração

1. O arquivo é interpretado e normalizado.
2. Todas as entradas precisam ser válidas para formar o estado candidato.
3. O estado anterior recebe um snapshot recuperável.
4. O estado candidato é salvo.
5. Somente então memória, controladores e UI recebem a substituição.

### Serviços externos

- O serviço de preços consulta e mantém cache por moeda.
- O serviço de TXID consulta o explorer e converte respostas em estados de auditoria.
- Timeout, abort e retry pertencem à infraestrutura, não aos componentes visuais.
- Respostas remotas atualizam dados derivados; elas não substituem o estado canônico inteiro.

## Estado persistido

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

Backups usam chaves separadas no mesmo `localStorage`. Como o armazenamento é local ao navegador, exportar JSON continua sendo a proteção portátil.

## Hotspots e lacunas

1. `js/app.js` ainda concentra DOM, estado e ciclo do gráfico.
2. Importação e migração atravessam schema, storage e UI, com alto impacto potencial sobre dados.
3. O gráfico combina canvas, rede, estado e plugins.
4. A troca de moeda precisa manter polling, cache, estado persistido e renderização sincronizados.
5. A semântica de fees, vendas, transferências e múltiplas moedas ainda exige decisão de produto.
6. `localStorage` não oferece coordenação automática entre abas.

## Verificação

- Jest: `npm test`
- Lint: `npm run lint`
- Tokens: `npm run tokens:check:full`
- SPA real e viewports: `npm run test:e2e`

Mudanças visuais exigem Playwright. Mudanças em persistência, migração, importação ou cálculos exigem testes de regressão específicos para falha e preservação do estado anterior.
