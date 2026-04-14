# Milestone M1 - Inicio do Desmonte Controlado do app.js

## 1. Nome do milestone
Milestone M1 - Inicio do Desmonte Controlado do `app.js`

## 2. Objetivo do milestone
Iniciar o desmonte controlado do `js/app.js` pelo caminho de menor risco, reduzindo acoplamento no dominio de tabela/transacao sem alterar comportamento visivel, schema, storage ou fluxos criticos do sistema.

## 3. Etapas incluidas neste marco
- Etapa 1A - Extrair helpers de tabela
- Etapa 2A - Extrair render de tabela
- Etapa 3B - Extrair binder de tabela/filtros

Observacao:
- este marco comeca obrigatoriamente pela Etapa 1A
- as etapas 2A e 3B so avancam se 1A estiver validada e encerrada

## 4. Invariantes reforcados
- nao mudar comportamento visivel da UI
- nao mudar schema canonico
- nao mudar formato salvo em storage
- nao mudar fluxo de import/export
- nao alterar logica de TXID/auditoria
- nao misturar este marco com features novas
- nao tocar outros dominios fora de tabela/filtros, salvo dependencia tecnica minima e explicita

## 5. Validacao obrigatoria
- `git diff --stat` antes de cada commit
- `npm test` obrigatorio em cada etapa
- smoke manual curto da area tocada em cada etapa

Smoke minimo esperado neste marco:
- abrir a tela principal
- verificar tabela de transacoes
- aplicar um filtro simples
- confirmar que lista, contagem e ordenacao continuam iguais
- confirmar que acoes de tabela continuam visiveis

## 6. Criterio de fechamento
- o dominio de tabela/filtros esta menos acoplado ao `js/app.js`
- helpers, render e bind da tabela/filtros estao separados conforme o escopo aprovado
- `npm test` permanece verde ao fim de cada etapa
- o comportamento visivel da tabela e dos filtros permanece igual
- o proximo passo do refactor ficou mais barato do que antes do marco

## 7. Primeira tarefa oficial executavel dentro do milestone

### Nome
Etapa 1A - Extrair helpers de tabela

### Objetivo
Retirar de `js/app.js` os helpers puros do dominio de tabela/transacao, criando um primeiro modulo reutilizavel em `js/ui/table/helpers.js` sem tocar em render, bind, state ou outros dominios.

### Escopo
Entra:
- helpers puros de leitura/formatacao de transacao
- labels de ordenacao
- status textual/efetivo de TX

Nao entra:
- render de tabela
- bind de tabela/filtros
- estado compartilhado
- import/export
- auditoria
- metas
- grafico

### Arquivos previstos
- origem: `js/app.js`
- destino: `js/ui/table/helpers.js`

### Invariantes
- tabela continua com o mesmo comportamento visivel
- nenhuma mudanca em schema/storage
- nenhum efeito colateral fora do dominio de tabela/transacao

### Validacao minima
- rodar `npm test`
- smoke manual:
  - abrir a tela principal
  - conferir a tabela
  - aplicar um filtro simples
  - verificar que os textos e a lista continuam iguais

### Condicao de parada
- se o diff atingir outros dominios alem de tabela/transacao
- se surgir dependencia escondida de DOM, state ou fetch dentro dos helpers
- se `npm test` falhar

### Rollback
- devolver os helpers para `js/app.js`
- remover ou esvaziar `js/ui/table/helpers.js`
- restaurar imports locais

### Criterio de aceite
- helpers puros extraidos
- `app.js` usando imports do novo modulo
- comportamento da tabela preservado
- testes verdes

## 8. Status atual do milestone
- Etapa 1A - Encerrada
- Etapa 2A - Encerrada
- Etapa 3B - Encerrada
- Milestone M1 - Fechado

## 9. Tarefa oficial atual

### Nome
Encerrada

### Objetivo
Nenhuma. O escopo do M1 foi concluido com a validacao tecnica e o smoke manual da 3B.

### Escopo
- milestone encerrado

### Arquivos previstos
- n/a

### Invariantes
- comportamento visivel preservado
- escopo do dominio de tabela/filtros concluido sem tocar outros dominios

### Validacao minima
- `npm test` verde
- smoke manual aprovado para:
  - aplicar filtro
  - limpar filtro
  - trocar ano
  - editar linha
  - apagar linha

### Condicao de parada
- n/a

### Rollback
- n/a

### Criterio de aceite
- helpers, render e bind de tabela/filtros extraidos
- `app.js` menos acoplado no dominio de tabela/filtros
- smoke manual aprovado
- milestone encerrado
