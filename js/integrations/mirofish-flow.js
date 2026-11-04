/**
 * Estado efêmero do Scenario Lab. Não consulta nem modifica estado de carteira.
 * Cada transição com custo externo exige uma ação explícita do usuário.
 */
export function createMiroFishFlow(client, onChange = () => {}) {
  if (!client || typeof client.generateOntologyFromText !== 'function') {
    throw new TypeError('Cliente MiroFish obrigatório.');
  }
  if (typeof onChange !== 'function') throw new TypeError('onChange inválido.');

  const state = {
    projectId: '',
    graphTaskId: '',
    graphId: '',
    graphStatus: '',
    graphProgress: 0,
    simulationId: '',
    prepareTaskId: '',
    prepareStatus: '',
    prepareProgress: 0,
    prepared: false,
    runStarted: false,
    runStatus: '',
    runProgress: 0,
    runComplete: false,
    reportTaskId: '',
    reportId: '',
    reportStatus: '',
    reportProgress: 0,
    reportReady: false,
    reportText: '',
    busy: false,
    action: '',
    error: '',
  };

  const snapshot = () => Object.freeze({ ...state });
  const notify = () => onChange(snapshot());
  const requireStage = (condition, description) => {
    if (!condition) throw new Error('Etapa indisponível: ' + description);
  };
  const validId = (value) =>
    typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
  const status = (value) => String(value || '').toLowerCase();
  const progress = (value) =>
    Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  const isFailure = (value) => ['failed', 'error', 'cancelled'].includes(value);

  async function action(name, fn) {
    requireStage(!state.busy, 'há outra operação em andamento');
    state.busy = true;
    state.error = '';
    state.action = name;
    notify();
    try {
      return await fn();
    } catch (error) {
      state.error = error instanceof Error ? error.message : 'Erro desconhecido.';
      notify();
      throw error;
    } finally {
      state.busy = false;
      state.action = '';
      notify();
    }
  }

  async function createContext(input) {
    requireStage(!state.projectId, 'o contexto já foi criado nesta sessão');
    return action('Criando contexto', async () => {
      const data = await client.generateOntologyFromText(input);
      requireStage(validId(data?.project_id), 'a API não forneceu project_id');
      state.projectId = data.project_id;
      notify();
      return snapshot();
    });
  }

  async function buildGraph() {
    requireStage(validId(state.projectId) && !state.graphTaskId, 'crie um contexto primeiro');
    return action('Construindo grafo', async () => {
      const data = await client.buildGraph(state.projectId);
      requireStage(validId(data?.task_id), 'a API não forneceu task_id');
      state.graphTaskId = data.task_id;
      state.graphStatus = 'pending';
      notify();
      return snapshot();
    });
  }

  async function refreshGraph() {
    requireStage(validId(state.graphTaskId), 'inicie a construção do grafo');
    return action('Consultando grafo', async () => {
      const data = await client.getGraphTask(state.graphTaskId);
      state.graphStatus = status(data?.status);
      state.graphProgress = progress(data?.progress);
      if (isFailure(state.graphStatus)) throw new Error('Falha no grafo: ' + String(data?.message || 'consulte o servidor').slice(0, 240));
      if (state.graphStatus === 'completed') {
        requireStage(validId(data?.result?.graph_id), 'o grafo terminou sem graph_id');
        state.graphId = data.result.graph_id;
      }
      notify();
      return snapshot();
    });
  }

  async function createSimulation() {
    requireStage(validId(state.projectId) && validId(state.graphId) && !state.simulationId, 'aguarde o grafo');
    return action('Criando agentes', async () => {
      const data = await client.createSimulation({ projectId: state.projectId, graphId: state.graphId });
      requireStage(validId(data?.simulation_id), 'a API não forneceu simulation_id');
      state.simulationId = data.simulation_id;
      notify();
      return snapshot();
    });
  }

  async function prepareSimulation() {
    requireStage(validId(state.simulationId) && !state.prepareTaskId && !state.prepared, 'crie a simulação primeiro');
    return action('Preparando agentes', async () => {
      const data = await client.prepareSimulation(state.simulationId);
      state.prepareStatus = status(data?.status);
      if (state.prepareStatus === 'ready' || data?.already_prepared === true) {
        state.prepared = true;
        state.prepareProgress = 100;
      } else {
        requireStage(validId(data?.task_id), 'a API não forneceu task_id');
        state.prepareTaskId = data.task_id;
      }
      notify();
      return snapshot();
    });
  }

  async function refreshPreparation() {
    requireStage(validId(state.simulationId), 'crie a simulação primeiro');
    return action('Consultando agentes', async () => {
      const data = await client.getPrepareStatus({
        taskId: state.prepareTaskId || undefined,
        simulationId: state.simulationId,
      });
      state.prepareStatus = status(data?.status);
      state.prepareProgress = progress(data?.progress);
      if (isFailure(state.prepareStatus)) throw new Error('Falha na preparação: ' + String(data?.message || 'consulte o servidor').slice(0, 240));
      if (['ready', 'completed'].includes(state.prepareStatus)) state.prepared = true;
      notify();
      return snapshot();
    });
  }

  async function startSimulation() {
    requireStage(state.prepared && !state.runStarted, 'aguarde a preparação dos agentes');
    return action('Iniciando simulação', async () => {
      await client.startSimulation(state.simulationId);
      state.runStarted = true;
      state.runStatus = 'starting';
      notify();
      return snapshot();
    });
  }

  async function refreshRun() {
    requireStage(state.runStarted, 'inicie a simulação primeiro');
    return action('Consultando execução', async () => {
      const data = await client.getRunStatus(state.simulationId);
      state.runStatus = status(data?.runner_status);
      state.runProgress = progress(data?.progress_percent);
      if (isFailure(state.runStatus)) throw new Error('Falha na simulação.');
      state.runComplete = ['completed', 'stopped'].includes(state.runStatus);
      notify();
      return snapshot();
    });
  }

  async function generateReport() {
    requireStage(state.runComplete && !state.reportTaskId && !state.reportReady, 'aguarde a conclusão da simulação');
    return action('Gerando relatório', async () => {
      const data = await client.generateReport(state.simulationId);
      state.reportStatus = status(data?.status);
      if (validId(data?.report_id)) state.reportId = data.report_id;
      if (state.reportStatus === 'completed') {
        state.reportReady = true;
      } else {
        requireStage(validId(data?.task_id), 'a API não forneceu task_id');
        state.reportTaskId = data.task_id;
      }
      notify();
      return snapshot();
    });
  }

  async function refreshReport() {
    requireStage(state.reportTaskId || state.reportReady, 'inicie a geração de relatório');
    return action('Consultando relatório', async () => {
      const data = await client.getReportStatus({
        taskId: state.reportTaskId || undefined,
        simulationId: state.simulationId,
      });
      state.reportStatus = status(data?.status);
      state.reportProgress = progress(data?.progress);
      if (isFailure(state.reportStatus)) throw new Error('Falha no relatório: ' + String(data?.message || 'consulte o servidor').slice(0, 240));
      if (state.reportStatus === 'completed') {
        state.reportReady = true;
        const id = data?.report_id || data?.result?.report_id;
        if (validId(id)) state.reportId = id;
      }
      notify();
      return snapshot();
    });
  }

  async function loadReport() {
    requireStage(state.reportReady && validId(state.reportId), 'aguarde um relatório concluído com report_id');
    return action('Carregando relatório', async () => {
      const data = await client.getReport(state.reportId);
      requireStage(typeof data?.markdown_content === 'string', 'relatório sem conteúdo de texto');
      state.reportText = data.markdown_content;
      notify();
      return snapshot();
    });
  }

  notify();
  return Object.freeze({
    snapshot,
    createContext,
    buildGraph,
    refreshGraph,
    createSimulation,
    prepareSimulation,
    refreshPreparation,
    startSimulation,
    refreshRun,
    generateReport,
    refreshReport,
    loadReport,
  });
}
