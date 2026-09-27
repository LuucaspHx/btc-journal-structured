# Playbook de mudanças

Este processo mantém alterações pequenas, recuperáveis e verificáveis. Ele se aplica a correções, features e refactors.

## 1. Preparar

1. Confirme branch, commit base e `git status`.
2. Descreva o comportamento a mudar e as invariantes que devem permanecer.
3. Identifique as superfícies afetadas: domínio, storage, rede, UI e documentação.
4. Reproduza o problema ou estabeleça uma baseline mensurável.

Use um worktree isolado quando houver trabalho paralelo ou mudanças locais que precisam ser preservadas.

## 2. Delimitar

Uma tarefa deve ter:

- objetivo observável;
- arquivos ou camadas esperadas;
- riscos para dados e comportamento;
- verificações necessárias;
- condição de parada;
- estratégia simples de reversão.

Separe mudanças independentes quando isso tornar a revisão e o rollback mais claros. Não force um commit por etapa se a divisão criar estados incompletos.

## 3. Implementar

- Preserve contratos persistidos ou faça uma migração explícita.
- Mantenha regras de negócio fora do DOM e da rede.
- Salve estado candidato antes de publicá-lo em memória ou na UI.
- Trate importações como dados não confiáveis.
- Evite reescritas amplas quando uma correção localizada oferece evidência melhor.
- Atualize testes que provam o comportamento e a falha relevante; não replique a implementação em testes triviais.

## 4. Verificar

Execute os gates proporcionais ao diff:

| Superfície | Verificação mínima |
| --- | --- |
| Qualquer código | `npm test` e `npm run lint` |
| Tokens/estilo | `npm run tokens:check:full` |
| HTML, CSS, navegação, layout ou render | `npm run test:e2e` |
| Storage, importação ou migração | Testes de atomicidade, backup e recuperação |
| Integração externa | Teste determinístico e smoke real quando necessário |

Revise também `git diff --check`, `git diff --stat` e o diff completo. Registre um resumo dos resultados no PR ou artefato de entrega.

## 5. Documentar e entregar

- Atualize `project-brain.md` somente se uma decisão durável, limite, invariante ou questão aberta mudar.
- Atualize `docs/architecture-map.md` quando responsabilidades ou fluxos reais mudarem.
- Use `docs/DEFINITION_OF_DONE.md` como checklist de entrega.
- Faça commits coesos com mensagens descritivas.
- Abra o PR como draft enquanto houver verificação ou decisão pendente.

## Condições de parada

Pare e reduza o escopo quando:

- a correção exige decidir semântica financeira não especificada;
- uma migração não consegue preservar o estado anterior;
- o diff atravessa camadas sem um contrato verificável;
- testes revelam regressão fora do comportamento pretendido;
- a evidência disponível contradiz a premissa da tarefa.

## Snapshots

ZIPs são artefatos de marcos ou handoffs, não mecanismo cotidiano de versionamento. Um snapshot deve apontar para um commit validado e excluir `.git`, `node_modules`, cobertura, credenciais e dados pessoais.
