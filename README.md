# BTC Journal

SPA estática para registrar operações em Bitcoin, acompanhar custo e desempenho, validar TXIDs e organizar metas em satoshis. Os dados ficam no `localStorage` do navegador; não há backend nem conta remota.

## Executar localmente

Requer uma versão de Node suportada pelo projeto e Python 3 para o servidor estático.

```bash
npm ci
python3 -m http.server 8000
```

Abra `http://localhost:8000`.

## Verificações

```bash
npm test
npm run lint
npm run test:e2e
```

O Playwright instala seu navegador separadamente quando necessário:

```bash
npx playwright install chromium
```

Mudanças de estilo também devem preservar os tokens:

```bash
npm run tokens:check:full
```

## Dados e dependências externas

- Estado canônico: `btc_journal_state_v3` no `localStorage`.
- Preços e histórico: CoinGecko.
- Validação on-chain: mempool.space.
- Gráficos e datas: bibliotecas carregadas por CDN no navegador.

Exporte o JSON periodicamente. Limpar os dados do navegador pode apagar o diário local.

## Entrega

O GitHub Actions testa branches e pull requests. O deploy do GitHub Pages ocorre somente a partir de `main` e publica o conteúdo preparado em `dist/`; consulte `.github/workflows/deploy-pages.yml` para o contrato executável.

Arquitetura e critérios de entrega estão em [docs/architecture-map.md](docs/architecture-map.md) e [docs/DEFINITION_OF_DONE.md](docs/DEFINITION_OF_DONE.md).
