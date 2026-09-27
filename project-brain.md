# BTC Journal — Project Brain

Este documento guarda decisões duráveis, limites do produto e questões abertas. O estado técnico deve sempre ser confirmado no filesystem, no Git e nos workflows.

## Propósito e limites

- O produto é um diário pessoal de Bitcoin orientado a satoshis.
- A SPA roda sem backend e mantém o estado principal no `localStorage`.
- CoinGecko fornece preços; mempool.space fornece evidência on-chain de TXIDs.
- Privacidade local e portabilidade dos dados são requisitos do produto.
- Desktop é a superfície principal. A mesma engine deve funcionar em telas menores.
- O visual pretendido é escuro, denso e premium, com laranja Bitcoin e foco em dados.

## Decisões técnicas

- `btc_journal_state_v3` e `SCHEMA_VERSION = 3` são os contratos persistidos atuais.
- Regras de domínio devem permanecer independentes de DOM, rede e storage.
- `js/app.js` é a composition root; extrações devem reduzir sua responsabilidade por contratos pequenos e testáveis.
- Módulos de UI recebem callbacks e snapshots. Eles não mantêm um segundo estado de domínio.
- Desktop e mobile compartilham estado, comandos e cálculos.
- Importações e migrações só substituem o estado depois de backup e persistência bem-sucedidos.
- JSON é o formato de backup recuperável. CSV é um formato tabular de interoperabilidade.
- GitHub Pages publica `dist/` somente a partir de `main`.

## Invariantes de dados

- Valores em satoshis persistidos devem ser inteiros seguros e não negativos.
- Importação deve canonizar campos antes de expô-los ao runtime ou ao DOM.
- Uma migração inválida deve falhar inteira; não pode descartar linhas silenciosamente.
- Dados derivados de validação remota não devem ser aceitos como autoridade em um arquivo importado.
- URLs exibidas pela interface devem ser construídas a partir de provedores e identificadores validados.
- Toda operação destrutiva precisa preservar uma cópia recuperável do estado anterior.

## Questões de produto ainda abertas

Estas decisões afetam resultados financeiros e precisam de uma especificação explícita antes de mudanças no código:

1. Como `buy`, `sell` e `transfer` alteram saldo, custo e metas.
2. Se fees entram no custo por linha, no custo agregado ou em ambos.
3. Como tratar carteiras com mais de uma moeda fiduciária.
4. Qual regra de arredondamento converte BTC e fiat para satoshis.
5. Se filtros da tabela alteram somente a tabela ou também os KPIs.
6. Como resolver edições concorrentes em duas abas.

## Riscos conhecidos

- O navegador pode apagar `localStorage`; o usuário depende de exportações periódicas.
- `js/app.js` ainda combina coordenação, renderização e partes do ciclo de vida do gráfico.
- Falhas das APIs externas degradam preço, histórico e auditoria.
- A semântica financeira incompleta pode produzir totais internamente consistentes, porém incorretos para a intenção do usuário.
- Documentos e ZIPs históricos são evidência de contexto, não fonte de verdade do runtime atual.

## Fontes de verdade

- Código e estrutura atuais: filesystem e Git.
- Pipeline executável: `.github/workflows/` e `package.json`.
- Arquitetura observada: `docs/architecture-map.md`.
- Critérios de entrega: `docs/DEFINITION_OF_DONE.md`.
- Processo de mudanças: `docs/refactor-playbook.md`.

Atualize este arquivo apenas quando uma decisão, um limite do produto, uma invariante ou uma questão aberta mudar. Resultados de testes, inventários de arquivos, commits e próximos passos pertencem aos artefatos de entrega, não a esta memória.
