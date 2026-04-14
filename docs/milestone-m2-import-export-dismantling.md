# Milestone M2 - Desmonte Controlado do app.js no Dominio de Import/Export

## 1. Nome do milestone
Milestone M2 - Desmonte Controlado do `app.js` no dominio de import/export

## 2. Objetivo do milestone
Reduzir o acoplamento de `js/app.js` no dominio de import/export pelo caminho de menor risco, separando helpers, render e bind desse fluxo sem alterar schema, storage, compatibilidade de importacao ou comportamento visivel da UI.

## 3. Etapas incluidas neste marco
- Etapa 1B - Extrair helpers de import/export
- Etapa 2B - Extrair render de import/export
- Etapa 3C - Extrair binder de import/export

Observacao:
- este marco comeca obrigatoriamente pela Etapa 1B
- as etapas 2B e 3C so avancam se 1B estiver validada e encerrada

## 4. Invariantes reforcados
- nao mudar comportamento visivel da UI
- nao mudar schema canonico
- nao mudar formato salvo em storage
- nao mudar fluxo de import/export
- nao quebrar compatibilidade com payloads legados
- nao alterar logica de TXID/auditoria
- nao misturar este marco com features novas
- nao tocar outros dominios fora de import/export, salvo dependencia tecnica minima e explicita

## 5. Validacao obrigatoria
- `git diff --stat` antes de cada commit
- `npm test` obrigatorio em cada etapa
- smoke manual curto da area tocada em cada etapa

Smoke minimo esperado neste marco:
- abrir o modal de exportacao
- conferir o preview JSON
- descarregar JSON ou CSV
- abrir o fluxo de importacao com um arquivo valido
- confirmar que a pre-visualizacao e o resumo continuam iguais

## 6. Criterio de fechamento
- o dominio de import/export esta menos acoplado ao `js/app.js`
- helpers, render e bind de import/export estao separados conforme o escopo aprovado
- `npm test` permanece verde ao fim de cada etapa
- o comportamento visivel do fluxo de import/export permanece igual
- payloads atuais e legados continuam compativeis
- o proximo passo do refactor ficou mais barato do que antes do marco

## 7. Primeira tarefa oficial executavel dentro do milestone

### Nome
Etapa 1B - Extrair helpers de import/export

### Objetivo
Retirar de `js/app.js` os helpers puros do dominio de import/export, criando um modulo reutilizavel em `js/ui/import-export/helpers.js` sem tocar em render, bind, state ou outros dominios.

### Escopo
Entra:
- `csvEscape()`
- `normalizeImportShape()`
- `migrateLegacyImport()`
- `prepareImportPayloadFromText()`

Nao entra:
- modais de import/export
- downloads
- aplicacao do import
- estado compartilhado
- storage
- outros dominios

### Arquivos previstos
- origem: `js/app.js`
- destino: `js/ui/import-export/helpers.js`

### Invariantes
- o fluxo de import/export continua com o mesmo comportamento visivel
- nenhuma mudanca em schema/storage
- payloads validos atuais e legados continuam aceitos
- nenhum efeito colateral fora do dominio de import/export

### Validacao minima
- rodar `npm test`
- smoke manual:
  - abrir o modal de exportacao
  - conferir o preview JSON
  - carregar um arquivo JSON valido na importacao
  - verificar que resumo e pre-visualizacao continuam iguais

### Condicao de parada
- se o diff atingir dominios alem de import/export
- se surgir dependencia escondida de DOM, state ou fetch dentro dos helpers
- se `npm test` falhar

### Rollback
- devolver os helpers para `js/app.js`
- remover ou esvaziar `js/ui/import-export/helpers.js`
- restaurar imports locais

### Criterio de aceite
- helpers puros extraidos
- `app.js` usando imports do novo modulo
- comportamento de import/export preservado
- testes verdes
