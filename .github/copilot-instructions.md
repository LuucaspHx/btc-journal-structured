# Copilot Instructions for btc-journal-structured

## Visão Geral
Este projeto é uma aplicação web estática composta por três principais diretórios:

## Arquitetura e Fluxo de Dados
  ```js
  fetch('data/exemplo.json')
    .then(response => response.json())
    .then(data => {/* manipulação */});
  ```
  ```js
  document.getElementById('elemento').textContent = 'Novo valor';
  ```
````instructions
# Copilot instructions — btc-journal-structured (resumo rápido)

Visão curta e objetiva para agentes:

- Projeto: SPA estática (sem backend). Entrada única: `index.html`. Estilos em `css/style.css`. Dados exemplos em `data/exemplo.json`.
- Lógica principal fica inline em `index.html` (script) — há também `js/app.js` presente como placeholder; editar o inline script é a forma mais direta de modificar o comportamento atual.

Padrões e fluxos importantes (DISCOVERABLE)
- Dados de preços: `fetchPrices(days)` usa CoinGecko `/market_chart` para série de preços. Para candles usamos `fetchOHLC(days)` que chama `/coins/bitcoin/ohlc?vs_currency={vs}&days={days}`. Resultado mapeado para {x,t,o,h,l,c}.
- Gráfico: Chart.js v4 é carregado via CDN. Candles usam `chartjs-chart-financial` (CDN incluído). A linha de preço e um dataset `scatter` para os aportes coexistem; o scatter tem `order: 10` para ficar acima das velas.
- Estado: objeto `state` contém `vs`, `year`, `prices`, `ohlc`, `entries`, `chartMode` etc. `entries` são persistidas em localStorage sob a chave `btcJournalV1`.
- UI: `#chartMode` (select) alterna entre 'line' e 'candles'. Preferência é persistida em localStorage (`btcJournalChartMode`).

Como testar rapidamente (local)
1) Inicie um servidor estático na raiz do projeto (por exemplo):
```bash
cd /path/to/btc-journal-structured
python3 -m http.server 8000
```
2) Abra http://localhost:8000
3) Use o select "Visão" no header para escolher "Velas (candlestick)" — o app fará `fetchOHLC(90)` e renderizará as velas + linha + scatter.

Padrões de edição (concretos)
- Preferir editar o bloco inline em `index.html` onde estão as funções de render, fetch e handlers. Há poucas dependências externas; qualquer alteração que troque versões de CDN deve ser testada no navegador.
- Manter separação clara: manipulação de dados (fetch*/calcs) vs DOM/render (render*) vs eventos (bindEvents). Exemplos:
  - `pmMedio(entries)` calcula preço médio ponderado — usada na annotation do chart.
  - `fetchHistoricalPriceForDate(dateStr)` usa `state.prices` para aproximar o preço mais próximo de uma data.

Erros e debugging comuns
- Se as velas não aparecerem: verifique console por erro de registro do controller do plugin financeiro; `chartjs-chart-financial` normalmente registra automaticamente.
- Se o endpoint OHLC falhar, `state.ohlc` fica vazio e o app cai para renderizar apenas a linha. O overlay de loading envolve chamadas principais (agora também aplicadas a fetchOHLC).

Quick tips para PRs/edits
- Não remova o uso de CDNs sem incluir builds locais; este projeto não tem bundler.
- Ao adicionar novos datasets ao Chart, defina `order` para controlar a sobreposição (scatter deve ter order maior que candles).
- Persistir pequenas preferências (como `chartMode`) em localStorage é aceitável e já é usado aqui.

Se algo não estiver claro (ex.: desejar mover o script inline para `js/app.js` ou adicionar testes automatizados), peça e eu faço a sugestão/PR com mudanças mínimas e verificações.
````