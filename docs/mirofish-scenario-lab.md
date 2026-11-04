# MiroFish Scenario Lab — integração experimental (NÃO publicada)

## O que esta branch entrega

- Cliente JavaScript isolado em `js/integrations/mirofish-client.js`, apontado por padrão para `/mirofish/api/*` na **mesma origem** do BTC Journal.
- Chamadas reais do MiroFish para: gerar ontologia a partir de texto fornecido pelo usuário, construir grafo, acompanhar tarefa, criar/preparar/iniciar simulação, acompanhar execução e gerar/ler relatório.
- Workflow determinístico em `js/integrations/mirofish-flow.js`, com início de cada operação por clique explícito, controles de concorrência e status reais da API.
- Tela responsiva em `labs/mirofish/index.html`, `lab.css` e `lab.js`, com consentimento, estágio de processamento, IDs efêmeros e relatório renderizado apenas com `textContent`.
- Testes unitários do contrato/fluxo e testes E2E Playwright com backend **mockado**; não há execução real contra o serviço.
- O workflow de deploy está preparado para copiar `labs/` para `dist/` **somente quando a branch for mesclada**.
- Nenhuma alteração em `index.html`, `js/app.js`, schema v3, `btc_journal_state_v3`, preços, filtros, dashboard ou fluxo de aportes.

**Não é uma simulação executada. Não há backend conectado, nem integração com a Main Page ou com a URL chatgpt.site.** A página experimental existe apenas nesta branch e não faz solicitações automáticas ao iniciar. Não existe previsão de preço gerada localmente ou inventada.

## Como funciona o MiroFish (upstream)

O motor é um projeto separado (Python + frontend Node) que recebe documento/contexto, constrói ontologia e grafo, gera personas, executa agentes OASIS e produz um relatório. Ele requer LLM API e Zep Cloud configurados **no servidor**. Seu uso pode consumir créditos e tempo significativos.

Fonte: https://github.com/666ghj/MiroFish (README e `frontend/src/api/*.js` consultados em 2026-11-04).

Licença upstream: AGPL-3.0. Esta branch não copia/redistribui o código-fonte do motor. Antes de distribuir um serviço derivado do upstream, revisar as obrigações da licença.

## Arquitetura pretendida

    BTC Journal (SPA estática + localStorage)
       |
       | usuário insere texto não sensível e autoriza envio
       v
    Scenario Lab (UI experimental disponível nesta branch, sem consultar saldos)
       |
       v
    HTTPS same-origin /mirofish/api/*
       |
       v
    Gateway autenticado com limite de taxa e consumo
       |
       v
    MiroFish backend (Python) -> serviço LLM + Zep Cloud

A rota `/mirofish/api/*` é um contrato do BTC Journal, **não uma rota instalada**. Um gateway deve encaminhar essas chamadas para as rotas upstream `/api/*`. Hospedagem estática (GitHub Pages/ChatGPT Sites) não provisiona automaticamente esse gateway. Sem ele, os métodos retornarão erro de rede; o app principal continua operando.

Exemplo conceitual Nginx em **infraestrutura própria**:

    location /mirofish/api/ {
        proxy_pass http://127.0.0.1:5001/api/;
        proxy_read_timeout 300s;
        client_max_body_size 2m;
        # Exigir autenticação e rate limiting ANTES do proxy_pass.
    }

Nunca abrir a porta 5001 diretamente para usuários anônimos. Armazenar LLM_API_KEY e ZEP_API_KEY apenas no servidor. Configurar TLS, autenticação, quotas, proteção CSRF para cookies, logs sem dados sensíveis, política de retenção e isolamento por usuário. O cliente usa `credentials: same-origin`, o que não substitui essas proteções.

## Sequência mínima do fluxo

1. `generateOntologyFromText({projectName, requirement, seedText})`: POST `/api/graph/ontology/generate`, multipart com arquivo `btc-scenario.txt`. Retorna `project_id`.
2. `buildGraph(projectId)`: POST `/api/graph/build`. Consultar `getGraphTask(taskId)` até concluir.
3. `createSimulation({projectId})`: POST `/api/simulation/create`; `prepareSimulation(simulationId)`; consultar `getPrepareStatus(...)`.
4. `startSimulation(simulationId)`: POST `/api/simulation/start`; acompanhar `getRunStatus(simulationId)`.
5. `generateReport(simulationId)`; acompanhar `getReportStatus({ taskId, simulationId })` via **POST** `/api/report/generate/status`; quando completo, `getReport(reportId)`. O upstream não aceita GET por `report_id` nesse endpoint.

As transições entre etapas devem ser controladas pelos status reais retornados pelo servidor. Não gerar execuções automaticamente após abrir uma página; iniciar uma simulação gera custos.

## Privacidade e produto

- **Nunca** enviar a carteira, histórico de aportes, TXIDs, endereços, notas, importações JSON nem localStorage por padrão.
- Aceitar somente **texto de cenário explicitamente editado e confirmado pelo usuário**; um futuro recurso de dados públicos de mercado deve ser opt-in.
- Manter todos os resultados sob "Cenário hipotético": relatórios não são sinais de trading, probabilidades calibradas nem indicação comprovada da direção do preço.
- Proibir que um relatório altere saldos, ordens, metas, aportes ou registros auditáveis.
- Sem API keys no bundle, URL do navegador ou repositório.
- Validar limites no **servidor**. O limite de 100 mil caracteres no adaptador é apenas UX, não barreira de segurança.

## Próximos marcos antes de produção

1. Executar `npm test -- --runInBand` no checkout completo e validar os novos testes.
2. Definir o serviço/gateway autenticado que possa operar ao lado da hospedagem do site, respeitando CSP e autenticação.
3. Avaliar a UI Scenario Lab já criada e adicionar recuperação de sessão, cancelamento de tarefas e limites de gasto no servidor. A UI atualmente oferece status, erros e progresso manual, mas não recupera uma sessão depois de recarregar.
4. Testar integração real E2E contra uma instalação MiroFish de testes e verificar a versão de API fixada.
5. Fazer security review, auditoria AGPL-3.0 e testes de isolamento: nenhuma mutação sobre a engine do BTC Journal.
6. Submeter aprovação do executor canônico (Codex) e mesclar somente depois da suite, E2E e revisão.

## Status de implementação

**Entregue na branch:** adaptador, fluxo por etapas, interface experimental e testes unitários/E2E mockados. **Não entregue:** MiroFish backend, gateway autenticado, execução real, interface na Main Page e publicação em produção. O workflow de publicação foi preparado, mas não ativado no site público. O PR continua em draft para revisão do Codex, conforme o fluxo de executor único.
