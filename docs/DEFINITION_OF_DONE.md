# Definition of Done

## Regra de Ouro

> Estado técnico = filesystem + git. Brain = decisões + contexto. Nunca ao contrário.

Nenhum milestone fecha por declaração. Fecha por evidência — output real de comandos.

---

## DoD — Milestone de Produto (M*)

- [ ] `npm test` verde com output colado
- [ ] `git status --short` limpo
- [ ] Código commitado no repo canónico
- [ ] `project-brain.md` atualizado apenas nas seções de decisões/contexto
- [ ] Smoke manual documentado (se aplicável)

## DoD — Milestone de Engenharia (E*)

- [ ] Critério de fecho da spec executado e output colado
- [ ] `npm test` verde
- [ ] `git status --short` limpo
- [ ] Commit presente no histórico com mensagem descritiva

## DoD — Pull Request

- [ ] CI "Tests" verde no GitHub
- [ ] Sem ficheiros não intencionais no diff
- [ ] `project-brain.md` atualizado se decisões arquiteturais mudaram

---

## Regras para Agentes

1. Verificar filesystem antes de reportar estado
2. Colar output real de `npm test` ao fechar qualquer milestone
3. Repo canónico: `/Users/lucas_phx/Documents/btc-journal-structured`
4. Nunca marcar trabalho como feito sem evidência verificável
