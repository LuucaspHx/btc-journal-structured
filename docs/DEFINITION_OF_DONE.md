# Definition of Done

Estado técnico é comprovado pelo filesystem, Git e checks executados. Documentos registram decisões e contexto.

## Mudança de código

- [ ] O diff contém apenas arquivos intencionais.
- [ ] Testes relevantes foram executados e seu resultado está ligado ao PR ou artefato de entrega.
- [ ] `npm test` está verde.
- [ ] `npm run lint` está verde.
- [ ] Mudanças de tokens passam em `npm run tokens:check:full`.
- [ ] Mudanças visuais, de navegação ou renderização passam em `npm run test:e2e`.
- [ ] Mudanças de storage/import/migração provam falha atômica e recuperação do estado anterior.
- [ ] O commit tem mensagem descritiva e pode ser revertido sem depender de arquivos locais.

## Pull request

- [ ] CI está verde no GitHub.
- [ ] Título e descrição explicam comportamento, risco e validação.
- [ ] Não há artefatos locais, dados pessoais, credenciais ou arquivos históricos acidentais.
- [ ] Decisões arquiteturais ou de produto alteradas foram registradas no `project-brain.md`.
- [ ] Limitações ou decisões pendentes que afetam correção estão explícitas.

## Marco ou snapshot

- [ ] O commit e a branch exatos estão identificados.
- [ ] O conjunto completo de verificações exigidas está verde.
- [ ] O working tree usado para entrega não contém mudanças intencionais omitidas.
- [ ] Smoke manual está documentado quando integrações reais ou comportamento visual não são cobertos automaticamente.
- [ ] Um ZIP, se necessário, foi criado somente depois da validação e exclui `.git`, `node_modules`, cobertura e dados pessoais.

Não é necessário colar grandes outputs em documentos versionados. Preserve um resumo verificável e um link para o check, PR ou artefato de auditoria correspondente.
