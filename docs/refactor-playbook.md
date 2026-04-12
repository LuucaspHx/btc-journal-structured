# Processo Oficial do Projeto

## Objetivo
Estabelecer um fluxo operacional de engenharia para evoluir o projeto com seguranca, previsibilidade e controle de escopo.

Este processo existe para evitar:
- improviso estrutural
- vazamento de escopo
- regressões silenciosas
- refactors grandes demais
- perda de contexto entre ciclos

## 1. Principios do processo

### 1.1 Regra central
Nenhuma feature nova de medio/grande porte que aumente o acoplamento do runtime principal entra antes de o runtime principal estar sob controle.

### 1.2 Regra de execucao
- um dominio por vez
- uma etapa por vez
- um commit por etapa
- sem misturar refactor com feature
- sem alterar comportamento visivel sem tarefa explicita

### 1.3 Regra de seguranca
Toda etapa deve preservar:
- comportamento visivel da UI
- schema canonico
- formato salvo em storage
- fluxo de import/export
- compatibilidade de migracao
- estabilidade da auditoria/TXID, salvo quando a tarefa for explicitamente sobre isso

### 1.4 Regra de validacao
Nenhuma etapa e concluida sem:
- `npm test`
- smoke manual curto
- revisao de `git diff --stat`

Se `npm test` falhar, a etapa nao avanca.
Se o smoke falhar, a etapa volta para ajuste.

### 1.5 Regra de documentacao
Mudancas relevantes devem atualizar o `project-brain.md`.

### 1.6 Regra de snapshot
ZIP so e gerado em marco estavel, nao em microetapa.

## 2. Fases do processo operacional

### Fase 0 - Governanca
Responsavel:
- lideranca tecnica / owner do projeto

Entrada:
- estado atual do repositorio
- `project-brain.md`
- baseline funcional

Execucao:
- definir objetivo do ciclo
- definir invariantes
- definir cadencia de atualizacao
- definir politica de ZIP

Saida:
- objetivo oficial do ciclo
- regras do processo
- criterios de aceite

Criterio de aceite:
- a equipe sabe o que pode e o que nao pode mudar

### Fase 1 - Discovery
Responsavel:
- engenharia

Entrada:
- codigo atual
- HTML
- modulos core
- testes

Execucao:
- mapear arquivos e dependencias
- identificar hotspots
- rodar `npm test`
- fazer smoke principal

Saida:
- mapa tecnico do sistema
- lista de riscos
- lista de areas criticas

Criterio de aceite:
- o sistema esta entendido o suficiente para planejar sem chute

### Fase 2 - Arquitetura-alvo
Responsavel:
- lideranca tecnica

Entrada:
- discovery concluido

Execucao:
- definir fronteiras:
  - core
  - services
  - state
  - ui
  - `app.js`
- definir ordem do refactor
- definir contratos entre camadas

Saida:
- arquitetura-alvo oficial
- backlog macro

Criterio de aceite:
- existe um desenho claro de como o sistema deve ficar

### Fase 3 - Planejamento executivo
Responsavel:
- engenharia + lideranca tecnica

Entrada:
- arquitetura-alvo

Execucao:
- quebrar em etapas pequenas
- descrever por tarefa:
  - objetivo
  - escopo
  - arquivos
  - risco
  - teste minimo
  - rollback
  - condicao de parada
  - criterio de aceite

Saida:
- backlog executavel
- sequencia das etapas

Criterio de aceite:
- nenhuma tarefa depende de improviso estrutural

### Fase 4 - Execucao
Responsavel:
- engenharia

Entrada:
- tarefa pronta para execucao

Execucao:
- revisar escopo da tarefa
- revisar `git status`
- implementar so o dominio da etapa
- rodar `git diff --stat`
- se vazou escopo, parar
- rodar `npm test`
- fazer smoke manual curto
- atualizar `project-brain.md`, se aplicavel
- commitar

Saida:
- etapa concluida
- codigo validado
- memoria atualizada

Criterio de aceite:
- comportamento igual
- diff controlado
- rollback simples

### Fase 5 - Validacao
Responsavel:
- engenharia / QA informal

Entrada:
- etapa implementada

Execucao:
- validar o dominio tocado
- revalidar regressao minima do sistema
- conferir persistencia, se necessario
- conferir import/export, se necessario
- conferir integracoes externas, se necessario

Saida:
- validacao tecnica da etapa

Criterio de aceite:
- nada critico regrediu

### Fase 6 - Marco
Responsavel:
- owner / lideranca tecnica

Entrada:
- bloco de etapas fechado

Execucao:
- revisar estado do projeto
- atualizar docs estruturais
- decidir se o marco merece snapshot
- gerar novo ZIP, se aplicavel

Saida:
- milestone fechado
- snapshot estavel

Criterio de aceite:
- existe um estado confiavel e recuperavel do projeto

### Fase 7 - Retrospectiva operacional
Responsavel:
- lideranca tecnica

Entrada:
- milestone concluido

Execucao:
- revisar:
  - o que funcionou
  - o que atrasou
  - o que vazou escopo
  - o que precisa ajustar no processo

Saida:
- processo refinado

Criterio de aceite:
- o proximo ciclo fica mais barato e previsivel

## 3. Template de tarefa

Cada tarefa deve conter os seguintes campos:
- nome
- objetivo
- responsavel pela execucao
- aprovador da etapa
- escopo
- arquivos tocados
- invariantes
- teste minimo
- smoke manual
- risco
- dependencias / bloqueios
- condicao de parada
- rollback
- criterio de aceite
- evidencia:
  - resultado do `npm test`
  - `git diff --stat`
  - confirmacao do smoke manual
- atualiza `project-brain.md`? sim / nao
- gera ZIP? sim / nao

## 4. Template de milestone

Cada milestone deve conter:
- nome do marco
- objetivo do marco
- etapas incluidas
- invariantes reforcados
- validacao obrigatoria
- atualizacoes documentais
- geracao de ZIP: sim / nao
- criterio de fechamento

## 5. Politica de atualizacao do Project Brain

### Quando atualizar
Atualizar `project-brain.md` quando houver:
- mudanca relevante de arquitetura
- fechamento de etapa importante
- mudanca de prioridade
- nova zona de risco
- mudanca no proximo passo oficial

### O que atualizar
- estado atual
- proximo passo atual
- decisoes importantes
- regras para agentes, se necessario
- definition of done, se aplicavel

### O que nao fazer
- nao transformar o arquivo em diario detalhado de microtarefas
- nao registrar ruido operacional sem valor futuro

## 6. Politica de ZIP

### Quando gerar ZIP
ZIP so deve ser gerado em:
- milestone concluido
- snapshot estavel
- ponto de revisao tecnica
- handoff relevante

### Quando nao gerar ZIP
Nao gerar ZIP em:
- microetapas
- commits intermediarios
- estado quebrado
- refactor incompleto

### Regra adicional
O ZIP deve representar estado validado, nao apenas estado salvo.

### ZIP de revisao tecnica
Deve incluir:
- `index.html`
- `css/`
- `js/`
- `tests/`
- `package.json`
- `package-lock.json`
- `jest.config.cjs`
- `README.md`
- `project-brain.md`
- `docs/`, se existir

Deve excluir:
- `node_modules/`
- `coverage/`
- `.git/`
- `.DS_Store`
- artefatos historicos que nao participam do runtime

### ZIP de snapshot completo
Usar apenas quando houver necessidade explicita de congelar todo o estado do trabalho.

## 7. Responsabilidades por artefato

### `project-brain.md`
- dono: engenharia
- frequencia: alta

### `docs/architecture-map.md`
- dono: lideranca tecnica
- frequencia: media

### `docs/refactor-playbook.md`
- dono: lideranca tecnica
- frequencia: baixa

### ZIP
- dono: owner do projeto
- frequencia: baixa, por marco

## 8. Sequencia real para este projeto
- ciclo 1: governanca, discovery, arquitetura-alvo, planejamento executivo
- ciclo 2: helpers
- ciclo 3: render
- ciclo 4: binders
- ciclo 5: `app-state`
- ciclo 6: `app.js` como orquestrador
- ciclo 7: retomada funcional

## 9. Metrica de sucesso
O processo esta funcionando se:
- `app.js` fica menor e mais claro
- mais logica sai da UI
- estado fica mais previsivel
- testes permanecem verdes
- cada mudanca fica mais barata do que antes
- o proximo passo exige menos improviso do que o anterior

## 10. Regras operacionais permanentes
- um dominio por vez
- um commit por etapa
- sem misturar refactor com feature
- `git diff --stat` antes de cada commit
- `npm test` obrigatorio
- smoke manual obrigatorio
- `project-brain.md` atualizado quando a mudanca for relevante
- ZIP so em milestone

## 11. Criterio final de qualidade
Uma etapa so e aceita quando:
- comportamento visivel permanece igual
- invariantes continuam validos
- escopo nao vazou
- rollback e simples
- testes passaram
- smoke passou
- a proxima mudanca ficou mais barata do que antes
