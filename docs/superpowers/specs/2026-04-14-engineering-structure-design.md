# Engineering Structure — Design Spec
**Data:** 2026-04-14  
**Projecto:** btc-journal-structured  
**Autores:** Lucas + Claude Code (CLI) + Codex  
**Status:** Aprovado

---

## Contexto

O projecto tinha estrutura de engenharia insuficiente para suportar colaboração entre múltiplos agentes AI e crescimento para projectos maiores:

- CI sem execução de testes
- Código legítimo nunca commitado
- Dois repositórios a divergir silenciosamente
- Sem lint, sem hooks, sem branch protection
- `project-brain.md` desactualizado e usado como fonte de verdade indevidamente

---

## Princípio Central

> **Estado técnico = filesystem + git. Brain = decisões + contexto. Nunca o contrário.**

Nenhum milestone fecha por declaração. Fecha por evidência — output real de comandos.

---

## Abordagem Escolhida

**Milestones de engenharia sequenciais (Abordagem B):**

```
E1 → E2 → E3 → E4 → E5
```

Sequencial por design — E2 e E3 partilham `package.json`, paralelismo geraria conflito.

---

## Repositório Canónico

**`/Users/lucas_phx/Documents/btc-journal-structured`**

- `~/Projects/btc-journal-structured` — abandonado oficialmente
- Estado técnico (HEAD, branch) verificável por `git log` — não declarado aqui

---

## E1 — Repo Canónico Limpo

### Objectivo
Estado estritamente de produto, sem ambiguidade, verificável.

### O que entra no git
- `js/ui/audit/bind.js`, `helpers.js`, `render.js`
- `tests/ui-audit-helpers.test.js`
- `css/style.css`, `js/app.js`, `project-brain.md` (modificações existentes)

### O que fica ignorado (.gitignore actualizado)
- `.claude/`
- `soul_transfer_kit_gpt.json..rtf`
- `planilha.html`
- `agent/*.md`

### Decisões explícitas de descarte
| Ficheiro | Decisão | Motivo |
|---|---|---|
| `planilha.html` | Descartado | Experimento alheio ao produto |
| `soul_transfer_kit_gpt.json..rtf` | Descartado | Resquício pessoal, fora do escopo |
| `agent/*.md` | Ignorado | Artefacto operacional de agentes, não produto |
| `~/Projects/btc-journal-structured` | Abandonado | Repo divergente, canónico é Documents/ |

### Critério de Fecho — Evidência Obrigatória
```bash
git status --short        # zero linhas não ignoradas
git ls-files | sort       # inventário limpo
npm test                  # 23 suites / 123 testes verdes
```

---

## E2 — CI com Testes Obrigatórios

### Objectivo
Testes correm automaticamente em cada PR e push. Nenhum código chega a `main` sem passar nos testes.

### O que fazer
- Criar `.github/workflows/test.yml` — corre `npm test` em PRs e push para qualquer branch
- Adicionar cobertura mínima obrigatória (threshold a definir em E2)
- O workflow de deploy existente (`deploy-pages.yml`) continua mas só dispara após testes verdes

### Critério de Fecho
```bash
# PR aberto → CI corre → testes verdes visíveis no GitHub
git log --oneline -3      # commit de E2 presente
```

---

## E3 — Lint + Format + Pre-commit Hooks

### Objectivo
Código consistente e sem erros básicos antes de chegar ao git.

### O que fazer
- Adicionar ESLint + Prettier ao `package.json`
- Configurar `.eslintrc` e `.prettierrc` na raiz
- Instalar `husky` + `lint-staged` para pre-commit hook
- Hook: lint + format automático em cada commit

### Critério de Fecho
```bash
npm run lint              # zero erros
git commit (ficheiro sujo) # hook bloqueia ou corrige automaticamente
```

---

## E4 — Branch Protection + PR Obrigatório

### Objectivo
Nenhum push directo para `main`. Todo o trabalho passa por PR com CI verde.

### O que configurar (GitHub Settings)
- Branch protection em `main`
- Require PR antes de merge
- Require status checks (CI de testes) antes de merge
- Dismiss stale reviews

### Critério de Fecho
```bash
git push origin main      # bloqueado pelo GitHub
# PR criado → CI verde → merge permitido
```

---

## E5 — Definition of Done Formal + Project Brain Reestruturado

### Objectivo
`project-brain.md` torna-se documento de decisões e contexto — não de estado técnico.  
Estado técnico vive no git.

### O que fazer
- Remover secções de "Estado Actual" baseadas em declarações
- Adicionar secção "Regra de Ouro para Agentes" como primeira secção do documento
- Criar `docs/DEFINITION_OF_DONE.md` com critérios por tipo de milestone
- Definition of Done inclui: `npm test` verde + `git status` limpo + evidência colada

### Critério de Fecho
- `project-brain.md` sem estado técnico declarativo
- `docs/DEFINITION_OF_DONE.md` existente e completo
- Próximo milestone do produto (M3-B) abre com DoD aplicado

---

## Regra de Ouro para Agentes (vigente a partir de E1)

1. **Filesystem + git são a verdade.** Brain é contexto.
2. **Nada fecha sem evidência.** Output real de comandos, não declarações.
3. **Repo canónico é Documents/.** Qualquer outro é descartado.
4. **Write sets separados antes de paralelizar.** Overlap = conflito.
