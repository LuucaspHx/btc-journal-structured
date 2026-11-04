import { createMiroFishClient } from '../js/integrations/mirofish-client.js';

function success(data = {}) {
  return { ok: true, json: async () => ({ success: true, data }) };
}

describe('MiroFish adapter (somente integração real, sem simulação falsa)', () => {
  test('bloqueia origens externas, caminhos ambíguos e timeouts inválidos', () => {
    expect(() => createMiroFishClient({ basePath: 'https://example.com' })).toThrow();
    expect(() => createMiroFishClient({ basePath: '//example.com' })).toThrow();
    expect(() => createMiroFishClient({ basePath: '/../proxy' })).toThrow();
    expect(() => createMiroFishClient({ timeoutMs: 0 })).toThrow();
  });

  test('nunca expõe chaves nem envia cookies cross-origin', async () => {
    const calls = [];
    const client = createMiroFishClient({
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return success({ task_id: 'task_123' });
      },
    });
    await client.buildGraph('proj_123');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/mirofish/api/graph/build');
    expect(calls[0].options.credentials).toBe('same-origin');
    expect(calls[0].options.body).toBe(JSON.stringify({ project_id: 'proj_123' }));
    expect(calls[0].options.headers.Authorization).toBeUndefined();
  });

  test('cria contexto somente com texto explicitamente enviado', async () => {
    let captured;
    const client = createMiroFishClient({
      fetchImpl: async (_url, options) => {
        captured = options.body;
        return success({ project_id: 'proj_123' });
      },
    });
    const result = await client.generateOntologyFromText({
      projectName: 'Cenário BTC',
      requirement: 'Como agentes reagiriam a um anúncio hipotético?',
      seedText: 'Uma notícia hipotética, sem dados reais de carteira.',
    });
    expect(result.project_id).toBe('proj_123');
    expect(captured).toBeInstanceOf(FormData);
    expect(captured.get('simulation_requirement')).toContain('agentes');
    expect(captured.get('files').name).toBe('btc-scenario.txt');
  });

  test('não aceita IDs que permitiriam alterar caminhos da API', async () => {
    const client = createMiroFishClient({ fetchImpl: async () => success() });
    expect(() => client.getRunStatus('../secrets')).toThrow();
    expect(() => client.getReport('bad/id')).toThrow();
  });

  test('segue endpoints documentados pelo MiroFish sem disparar tarefas extras', async () => {
    const paths = [];
    const client = createMiroFishClient({
      fetchImpl: async (url) => {
        paths.push(url);
        return success({ status: 'processing' });
      },
    });
    await client.createSimulation({ projectId: 'proj_123', graphId: 'graph_123' });
    await client.prepareSimulation('sim_123');
    await client.getPrepareStatus({ taskId: 'task_1' });
    await client.startSimulation('sim_123');
    await client.getRunStatus('sim_123');
    await client.generateReport('sim_123');
    await client.getReportStatus('report_123');
    await client.getReport('report_123');
    expect(paths).toEqual([
      '/mirofish/api/simulation/create',
      '/mirofish/api/simulation/prepare',
      '/mirofish/api/simulation/prepare/status',
      '/mirofish/api/simulation/start',
      '/mirofish/api/simulation/sim_123/run-status',
      '/mirofish/api/report/generate',
      '/mirofish/api/report/generate/status?report_id=report_123',
      '/mirofish/api/report/report_123',
    ]);
  });

  test('falhas do backend nunca são confundidas com relatórios válidos', async () => {
    const client = createMiroFishClient({
      fetchImpl: async () => ({
        ok: false,
        json: async () => ({ success: false, error: 'Serviço indisponível' }),
      }),
    });
    await expect(client.getReport('report_123')).rejects.toThrow('Serviço indisponível');
  });
});
