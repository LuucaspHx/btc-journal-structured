# Engineering Structure E1→E5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estabelecer estrutura de engenharia profissional no btc-journal-structured — repo limpo, CI com testes, lint, branch protection e Definition of Done formal.

> **Dependência explícita E2 + E4:** O workflow de CI (E2) corre testes em todos os branches e PRs. O `deploy-pages.yml` existente não é alterado — continua a deployar de `main` em cada push. O **gating real do deploy** (garantia de que código com testes falhos nunca chega a `main`) só fica activo após E4, quando branch protection impede merge sem CI verde. E2 e E4 são complementares — nenhum sozinho fecha o ciclo.

**Architecture:** Cinco milestones sequenciais (E1→E5). Cada um fecha com evidência de comando real antes de avançar. Estado técnico vive no git, nunca em documentos declarativos.

**Tech Stack:** Node.js, Jest, ESLint, Prettier, Husky, lint-staged, GitHub Actions, GitHub Branch Protection

---

## Task 1 (E1): Repo Canónico Limpo

**Files:**
- Modify: `.gitignore`
- Stage: `js/ui/audit/bind.js`, `js/ui/audit/helpers.js`, `js/ui/audit/render.js`
- Stage: `tests/ui-audit-helpers.test.js`
- Stage: `css/style.css`, `js/app.js`, `project-brain.md`

- [ ] **Step 1: Actualizar .gitignore**

Abrir `.gitignore` e adicionar no fim:

```
# Claude Code local config
.claude/

# Resíduos operacionais e experimentais
soul_transfer_kit_gpt.json..rtf
planilha.html
agent/*.md
```

- [ ] **Step 2: Verificar que os ficheiros estão ignorados**

```bash
git check-ignore -v soul_transfer_kit_gpt.json..rtf planilha.html agent/from-claude-code-2026-04-14.md
```

Resultado esperado:
```
.gitignore:XX:soul_transfer_kit_gpt.json..rtf  soul_transfer_kit_gpt.json..rtf
.gitignore:XX:planilha.html  planilha.html
.gitignore:XX:agent/*.md  agent/from-claude-code-2026-04-14.md
```

- [ ] **Step 3: Correr testes para confirmar baseline**

```bash
npm test 2>&1 | grep -E "Suites|Tests:"
```

Resultado esperado:
```
Test Suites: 23 passed, 23 total
Tests:       123 passed, 123 total
```

Se falhar: parar. Não avançar sem testes verdes.

- [ ] **Step 4: Stage apenas ficheiros legítimos de produto**

```bash
git add js/ui/audit/bind.js js/ui/audit/helpers.js js/ui/audit/render.js
git add tests/ui-audit-helpers.test.js
git add css/style.css js/app.js project-brain.md
git add .gitignore
```

- [ ] **Step 5: Verificar git status limpo**

```bash
git status --short
```

Resultado esperado: apenas ficheiros staged (prefixo `A` ou `M`), zero linhas com `??` não ignoradas.

Se aparecer `??` não esperado: verificar se está coberto pelo `.gitignore` ou decidir explicitamente antes de continuar.

- [ ] **Step 6: Commit de E1**

```bash
git commit -m "chore(e1): repo canónico limpo — audit UI, testes e .gitignore"
```

- [ ] **Step 7: Verificar fecho de E1**

```bash
git status --short
git ls-files js/ tests/ | sort
npm test 2>&1 | grep -E "Suites|Tests:"
```

Critério de fecho:
- `git status --short` devolve zero linhas não ignoradas
- `git ls-files` lista todos os ficheiros legítimos
- `npm test` verde com 23 suites / 123 testes

**Rollback:** `git restore --staged .` para desfazer staging. `.gitignore` pode ser revertido com `git restore .gitignore`.

---

## Task 2 (E2): CI com Testes Obrigatórios

**Files:**
- Create: `.github/workflows/test.yml`
- Modify: `jest.config.cjs` (adicionar coverage thresholds)

- [ ] **Step 1: Adicionar coverage thresholds ao jest.config.cjs**

Substituir o conteúdo de `jest.config.cjs` por:

```js
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/*.test.js',
    '**/*.spec.js',
    '**/*.test.mjs',
    '**/*.spec.mjs'
  ],
  collectCoverageFrom: [
    'js/**/*.js',
    '!node_modules/**'
  ],
  coverageThreshold: {
    global: {
      statements: 60,
      branches: 50,
      functions: 70,
      lines: 60
    }
  }
};
```

- [ ] **Step 2: Verificar que os testes continuam verdes com threshold**

```bash
npm test 2>&1 | grep -E "Suites|Tests:|ERROR|threshold"
```

Resultado esperado: 23 suites / 123 testes, sem erros de threshold.

Se falhar por threshold: ajustar os valores para corresponder à cobertura actual antes de continuar.

- [ ] **Step 3: Criar workflow de CI**

Criar `.github/workflows/test.yml`:

```yaml
name: Tests

on:
  push:
    branches: ["**"]
  pull_request:
    branches: ["**"]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test
```

- [ ] **Step 4: Commit de E2**

```bash
git add .github/workflows/test.yml jest.config.cjs
git commit -m "chore(e2): CI com testes obrigatórios e coverage thresholds"
```

- [ ] **Step 5: Push e verificar CI no GitHub**

```bash
git push origin feat/nova-funcionalidade
```

Depois: abrir o repositório no GitHub → separador Actions → confirmar que o workflow "Tests" aparece e corre.

Critério de fecho: workflow "Tests" verde no GitHub para este branch.

**Rollback:** `git revert HEAD` remove o commit. Apagar `.github/workflows/test.yml` manualmente se necessário.

---

## Task 3 (E3): Lint + Format + Pre-commit Hooks

**Files:**
- Create: `.eslintrc.json`
- Create: `.prettierrc.json`
- Modify: `package.json`
- Modify: `package-lock.json` (gerado automaticamente)

- [ ] **Step 1: Instalar dependências**

```bash
npm install --save-dev eslint prettier eslint-config-prettier husky lint-staged
```

Resultado esperado: `package.json` actualizado com novas devDependencies.

- [ ] **Step 2: Criar .eslintrc.json**

```json
{
  "env": {
    "browser": true,
    "es2022": true,
    "node": true
  },
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module"
  },
  "extends": ["eslint:recommended", "prettier"],
  "rules": {
    "no-unused-vars": "warn",
    "no-console": "off"
  }
}
```

- [ ] **Step 3: Criar .prettierrc.json**

```json
{
  "singleQuote": true,
  "semi": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

- [ ] **Step 4: Adicionar scripts e lint-staged ao package.json**

Actualizar `package.json`:

```json
{
  "name": "btc-journal-structured",
  "version": "1.0.0",
  "description": "BTC Journal - structured workspace for tests",
  "type": "module",
  "scripts": {
    "test": "NODE_OPTIONS=--experimental-vm-modules jest --coverage",
    "lint": "eslint js/**/*.js",
    "lint:fix": "eslint js/**/*.js --fix",
    "format": "prettier --write js/**/*.js"
  },
  "lint-staged": {
    "js/**/*.js": ["eslint --fix", "prettier --write"]
  },
  "devDependencies": {
    "eslint": "^8.0.0",
    "eslint-config-prettier": "^9.0.0",
    "husky": "^9.0.0",
    "jest": "^29.0.0",
    "lint-staged": "^15.0.0",
    "prettier": "^3.0.0"
  }
}
```

- [ ] **Step 5: Verificar lint no código actual**

```bash
npm run lint 2>&1 | tail -5
```

Se houver erros: correr `npm run lint:fix` e verificar que testes continuam verdes (`npm test`).

- [ ] **Step 6: Inicializar husky**

```bash
npx husky init
```

Resultado esperado: pasta `.husky/` criada com ficheiro `pre-commit`.

- [ ] **Step 7: Configurar pre-commit hook**

Substituir conteúdo de `.husky/pre-commit`:

```bash
#!/bin/sh
npx lint-staged
```

- [ ] **Step 8: Testar hook sem poluir histórico**

```bash
# Criar ficheiro temporário descartável (nunca commitado)
echo "const x=1" > js/hook-test-temp.js
git add js/hook-test-temp.js

# Correr lint-staged directamente — sem commit
npx lint-staged

# Verificar que o ficheiro foi corrigido automaticamente
cat js/hook-test-temp.js
```

Resultado esperado: `cat` mostra `const x = 1;` (espaços e ponto-e-vírgula corrigidos pelo Prettier).

```bash
# Limpar — sem nenhum commit de teste no histórico
git restore --staged js/hook-test-temp.js
rm js/hook-test-temp.js
```

Resultado esperado: `git status --short` sem referência a `hook-test-temp.js`.

- [ ] **Step 9: Commit de E3**

```bash
git add .eslintrc.json .prettierrc.json .husky/ package.json package-lock.json
git commit -m "chore(e3): lint, format e pre-commit hooks"
```

- [ ] **Step 10: Verificar testes após E3**

```bash
npm test 2>&1 | grep -E "Suites|Tests:"
```

Resultado esperado: 23 suites / 123 testes verdes.

**Rollback:** `npm uninstall eslint prettier eslint-config-prettier husky lint-staged`, apagar `.eslintrc.json`, `.prettierrc.json`, `.husky/`, reverter `package.json`.

---

## Task 4 (E4): Branch Protection + PR Obrigatório

**Files:** Nenhum ficheiro de código — configuração no GitHub.

- [ ] **Step 1: Abrir configurações do repositório no GitHub**

Navegar para: `https://github.com/LuucaspHx/btc-journal-structured/settings/branches`

- [ ] **Step 2: Adicionar regra de branch protection para `main`**

Clicar "Add branch ruleset" ou "Add rule" → Branch name pattern: `main`

Activar:
- ✅ Require a pull request before merging
- ✅ Require status checks to pass before merging
  - Adicionar status check: `test` (nome do job no `test.yml`)
- ✅ Dismiss stale pull request approvals when new commits are pushed

- [ ] **Step 3: Verificar que push directo para main está bloqueado**

Sem tocar em `main` localmente — forçar o ref remoto a partir do branch actual:

```bash
git push origin HEAD:main
```

Resultado esperado:
```
remote: error: GH006: Protected branch update failed for refs/heads/main.
```

Nenhum commit de teste, nenhum `reset --hard`. O branch local não muda.

Critério de fecho: push directo para `main` bloqueado pelo GitHub.

**Rollback:** Desactivar a regra em `Settings → Branches`.

---

## Task 5 (E5): Definition of Done Formal + Project Brain Reestruturado

**Files:**
- Create: `docs/DEFINITION_OF_DONE.md`
- Modify: `project-brain.md`

- [ ] **Step 1: Criar docs/DEFINITION_OF_DONE.md**

```markdown
# Definition of Done

## Regra de Ouro

> Estado técnico = filesystem + git. Brain = decisões + contexto. Nunca ao contrário.

Nenhum milestone fecha por declaração. Fecha por evidência — output real de comandos.

---

## DoD — Milestone de Produto (M*)

- [ ] `npm test` verde com output colado
- [ ] `git status --short` limpo
- [ ] Código commitado no repo canónico
- [ ] `project-brain.md` actualizado apenas nas secções de decisões/contexto
- [ ] Smoke manual documentado (se aplicável)

## DoD — Milestone de Engenharia (E*)

- [ ] Critério de fecho da spec executado e output colado
- [ ] `npm test` verde
- [ ] `git status --short` limpo
- [ ] Commit presente no histórico com mensagem descritiva

## DoD — Pull Request

- [ ] CI "Tests" verde no GitHub
- [ ] Sem ficheiros não intencionais no diff
- [ ] `project-brain.md` actualizado se decisões arquitecturais mudaram

---

## Regras para Agentes

1. Verificar filesystem antes de reportar estado
2. Colar output real de `npm test` ao fechar qualquer milestone
3. Repo canónico: `/Users/lucas_phx/Documents/btc-journal-structured`
4. Nunca marcar trabalho como feito sem evidência verificável
```

- [ ] **Step 2: Remover estado técnico declarativo do project-brain.md**

No `project-brain.md`, localizar e remover/substituir:
- Qualquer checkbox `[x]` com estado de ficheiros específicos
- Referências a "entregue" ou "concluído" sem evidência de commit
- Secção "Estado Atual" baseada em declarações — substituir por: `Ver git log para estado técnico actual.`
- Secção "Próximo Passo Atual" — manter apenas se descrever decisão, não tarefa técnica

- [ ] **Step 3: Adicionar Regra de Ouro como primeira secção do project-brain.md**

Inserir no topo do `project-brain.md` (após o título):

```markdown
## ⚖️ Regra de Ouro para Agentes

**Estado técnico = filesystem + git. Brain = decisões + contexto. Nunca ao contrário.**

- Verificar filesystem antes de reportar qualquer estado
- Ver `docs/DEFINITION_OF_DONE.md` antes de fechar qualquer milestone
- Repo canónico: `/Users/lucas_phx/Documents/btc-journal-structured`
```

- [ ] **Step 4: Verificar testes após alterações**

```bash
npm test 2>&1 | grep -E "Suites|Tests:"
```

Resultado esperado: 23 suites / 123 testes verdes.

- [ ] **Step 5: Commit de E5**

```bash
git add docs/DEFINITION_OF_DONE.md project-brain.md
git commit -m "chore(e5): DoD formal e project-brain reestruturado"
```

Critério de fecho:
- `docs/DEFINITION_OF_DONE.md` existe e está commitado
- `project-brain.md` sem estado técnico declarativo
- Próximo milestone do produto abre com DoD aplicado

**Rollback:** `git revert HEAD` remove as alterações documentais.

---

## Critérios de Fecho Globais

Após E5 completo, verificar a cadeia completa:

```bash
# 1. Testes verdes
npm test 2>&1 | grep -E "Suites|Tests:"
# Esperado: 23 suites / 123 testes

# 2. Repo limpo
git status --short
# Esperado: sem output (ou apenas ficheiros ignorados)

# 3. Histórico com todos os milestones
git log --oneline | head -6
# Esperado: commits e1, e2, e3, e5 presentes (e4 é configuração GitHub)

# 4. CI verde
# Verificar no GitHub → Actions → workflow "Tests"
```
