# Milestone M0 - Fundacao do Processo

## 1. Nome do milestone
Milestone M0 - Fundacao do Processo de Engenharia e do Refactor

## 2. Objetivo do milestone
Formalizar a base operacional do projeto para que a evolucao futura aconteca com controle de escopo, previsibilidade tecnica e checkpoints claros de documentacao e snapshot.

## 3. Artefatos entregues
- `docs/refactor-playbook.md`
- `docs/architecture-map.md`
- `project-brain.md` atualizado com:
  - processo oficial
  - cadencia documental e snapshots
  - ordem oficial do refactor

## 4. Criterio de fechamento
- o processo oficial do projeto esta documentado
- a arquitetura atual e a arquitetura-alvo estao mapeadas
- o `project-brain.md` referencia o processo e a politica de snapshots
- existe base suficiente para iniciar o refactor sem improviso estrutural

## 5. Proximo milestone recomendado
Milestone M1 - Refactor Inicial do Dominio de Tabela e Filtros

## 6. Primeira tarefa oficial do proximo milestone
Etapa 1A - Extrair helpers de tabela

Escopo inicial da tarefa:
- mover helpers puros do dominio de tabela/transacao para `js/ui/table/helpers.js`
- manter comportamento visivel identico
- nao tocar render, bind, state ou outros dominios
