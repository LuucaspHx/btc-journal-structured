import { createMiroFishFlow } from '../js/integrations/mirofish-flow.js';

function createClient(overrides = {}) {
  return {
    generateOntologyFromText: jest.fn(async () => ({ project_id: 'proj_demo' })),
    buildGraph: jest.fn(async () => ({ task_id: 'task_graph' })),
    getGraphTask: jest.fn(async () => ({ status: 'completed', progress: 100, result: { graph_id: 'graph_demo' } })),
    createSimulation: jest.fn(async () => ({ simulation_id: 'sim_demo' })),
    prepareSimulation: jest.fn(async () => ({ status: 'preparing', task_id: 'task_prepare' })),
    getPrepareStatus: jest.fn(async () => ({ status: 'ready', progress: 100 })),
    startSimulation: jest.fn(async () => ({ runner_status: 'running' })),
    getRunStatus: jest.fn(async () => ({ runner_status: 'completed', progress_percent: 100 })),
    generateReport: jest.fn(async () => ({ report_id: 'report_demo', task_id: 'task_report', status: 'generating' })),
    getReportStatus: jest.fn(async () => ({ status: 'completed', progress: 100, result: { report_id: 'report_demo' } })),
    getReport: jest.fn(async () => ({ markdown_content: '# Cenário hipotético\nNão é previsão de preço.' })),
    ...overrides,
  };
}

describe('MiroFish Scenario Flow', () => {
  test('não envia nenhum comando sem etapa anterior completa', async () => {
    const client = createClient();
    const flow = createMiroFishFlow(client);
    await expect(flow.buildGraph()).rejects.toThrow('Etapa indisponível');
    await expect(flow.startSimulation()).rejects.toThrow('Etapa indisponível');
    await expect(flow.generateReport()).rejects.toThrow('Etapa indisponível');
    expect(client.startSimulation).not.toHaveBeenCalled();
  });

  test('percorre as etapas com ações explícitas, sem saltar os estados intermediários', async () => {
    const client = createClient();
    const events = [];
    const flow = createMiroFishFlow(client, (state) => events.push(state));
    expect(flow.snapshot().projectId).toBe('');
    await flow.createContext({ projectName: 'Teste', requirement: 'Pergunta', seedText: 'Contexto consentido' });
    expect(flow.snapshot().projectId).toBe('proj_demo');
    expect(client.buildGraph).not.toHaveBeenCalled();

    await flow.buildGraph();
    expect(flow.snapshot().graphTaskId).toBe('task_graph');
    expect(flow.snapshot().graphId).toBe('');
    await flow.refreshGraph();
    expect(flow.snapshot().graphId).toBe('graph_demo');

    await flow.createSimulation();
    await flow.prepareSimulation();
    expect(flow.snapshot().prepared).toBe(false);
    await flow.refreshPreparation();
    expect(flow.snapshot().prepared).toBe(true);

    await flow.startSimulation();
    expect(flow.snapshot().runComplete).toBe(false);
    await flow.refreshRun();
    expect(flow.snapshot().runComplete).toBe(true);

    await flow.generateReport();
    expect(flow.snapshot().reportReady).toBe(false);
    await flow.refreshReport();
    expect(flow.snapshot().reportReady).toBe(true);
    await flow.loadReport();
    expect(flow.snapshot().reportText).toContain('Não é previsão');
    expect(client.getReportStatus).toHaveBeenCalledWith({ taskId: 'task_report', simulationId: 'sim_demo' });
    expect(events.some((state) => state.busy)).toBe(true);
    expect(flow.snapshot().busy).toBe(false);
  });

  test('não avança para simulação se o grafo falhar', async () => {
    const client = createClient({ getGraphTask: jest.fn(async () => ({ status: 'failed', message: 'Indisponível' })) });
    const flow = createMiroFishFlow(client);
    await flow.createContext({ projectName: 'Teste', requirement: 'Q', seedText: 'D' });
    await flow.buildGraph();
    await expect(flow.refreshGraph()).rejects.toThrow('Falha no grafo');
    expect(flow.snapshot().graphId).toBe('');
    expect(flow.snapshot().error).toContain('Falha no grafo');
    expect(flow.snapshot().busy).toBe(false);
    await expect(flow.createSimulation()).rejects.toThrow('Etapa indisponível');
    expect(client.createSimulation).not.toHaveBeenCalled();
  });

  test('não duplica operação com custo enquanto outra requisição está pendente', async () => {
    let release;
    const client = createClient({
      generateOntologyFromText: jest.fn(() => new Promise((resolve) => { release = resolve; })),
    });
    const flow = createMiroFishFlow(client);
    const first = flow.createContext({ projectName: 'A', requirement: 'B', seedText: 'C' });
    await expect(flow.createContext({ projectName: 'A', requirement: 'B', seedText: 'C' })).rejects.toThrow();
    expect(client.generateOntologyFromText).toHaveBeenCalledTimes(1);
    release({ project_id: 'proj_demo' });
    await first;
  });

  test('não inventa relatório ao receber saída incompleta', async () => {
    const client = createClient({
      getReport: jest.fn(async () => ({ status: 'completed', markdown_content: null })),
    });
    const flow = createMiroFishFlow(client);
    await flow.createContext({ projectName: 'T', requirement: 'Q', seedText: 'D' });
    await flow.buildGraph();
    await flow.refreshGraph();
    await flow.createSimulation();
    await flow.prepareSimulation();
    await flow.refreshPreparation();
    await flow.startSimulation();
    await flow.refreshRun();
    await flow.generateReport();
    await flow.refreshReport();
    await expect(flow.loadReport()).rejects.toThrow('relatório sem conteúdo');
    expect(flow.snapshot().reportText).toBe('');
  });
});
