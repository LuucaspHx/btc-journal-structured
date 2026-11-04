/**
 * Cliente opcional MiroFish. Integração por API, sem incorporar o runtime AGPL.
 *
 * Segurança: exige um reverse proxy SAME-ORIGIN em /mirofish (o proxy é
 * responsável pela autenticação). Nenhuma API key deve entrar no navegador.
 * Nenhum método lê localStorage ou dados da carteira BTC Journal.
 *
 * Referência upstream: https://github.com/666ghj/MiroFish
 */
const DEFAULT_BASE_PATH = '/mirofish';
const ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

function validateId(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new TypeError(label + ' inválido.');
  }
  return value;
}

function nonEmptyText(value, label, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new TypeError(label + ' deve ter entre 1 e ' + maxLength + ' caracteres.');
  }
  return value.trim();
}

function normalizeBasePath(value) {
  if (
    typeof value !== 'string' ||
    !/^\/[a-zA-Z0-9/_-]*$/.test(value) ||
    value.includes('//') ||
    value.includes('..')
  ) {
    throw new TypeError('basePath deve ser um caminho relativo à mesma origem.');
  }
  return value.replace(/\/$/, '');
}

function unwrapResponse(response, payload) {
  if (!response.ok || !payload || payload.success !== true) {
    const message =
      typeof payload?.error === 'string' && payload.error.trim()
        ? payload.error.slice(0, 240)
        : 'Erro ao comunicar com o serviço MiroFish.';
    throw new Error(message);
  }
  return payload.data;
}

/**
 * Não é um simulador local. Os métodos usam exclusivamente a API real do
 * MiroFish, que precisa estar instalada e exposta pelo proxy same-origin.
 */
export function createMiroFishClient({
  basePath = DEFAULT_BASE_PATH,
  fetchImpl = globalThis.fetch,
  timeoutMs = 300000,
} = {}) {
  const root = normalizeBasePath(basePath);
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl inválido.');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 600000) {
    throw new RangeError('timeoutMs deve estar entre 1000 e 600000.');
  }

  async function request(path, { method = 'GET', json, formData } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers = { Accept: 'application/json' };
      if (json !== undefined) headers['Content-Type'] = 'application/json';
      const response = await fetchImpl(root + path, {
        method,
        headers,
        body: formData ?? (json === undefined ? undefined : JSON.stringify(json)),
        signal: controller.signal,
        credentials: 'same-origin',
        cache: 'no-store',
      });
      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new Error('Resposta inválida do serviço MiroFish.');
      }
      return unwrapResponse(response, payload);
    } finally {
      clearTimeout(timer);
    }
  }

  function generateOntologyFromText({ projectName, requirement, seedText, context = '' }) {
    const form = new FormData();
    const content = nonEmptyText(seedText, 'Texto de contexto', 100000);
    form.append('files', new Blob([content], { type: 'text/plain' }), 'btc-scenario.txt');
    form.append('simulation_requirement', nonEmptyText(requirement, 'Pergunta', 5000));
    form.append('project_name', nonEmptyText(projectName, 'Projeto', 120));
    if (context) form.append('additional_context', nonEmptyText(context, 'Contexto', 5000));
    return request('/api/graph/ontology/generate', { method: 'POST', formData: form });
  }

  function buildGraph(projectId) {
    return request('/api/graph/build', {
      method: 'POST',
      json: { project_id: validateId(projectId, 'projectId') },
    });
  }

  function getGraphTask(taskId) {
    return request('/api/graph/task/' + validateId(taskId, 'taskId'));
  }

  function createSimulation({ projectId, graphId, enableTwitter = true, enableReddit = true }) {
    const json = {
      project_id: validateId(projectId, 'projectId'),
      enable_twitter: Boolean(enableTwitter),
      enable_reddit: Boolean(enableReddit),
    };
    if (graphId) json.graph_id = validateId(graphId, 'graphId');
    return request('/api/simulation/create', { method: 'POST', json });
  }

  function prepareSimulation(simulationId) {
    return request('/api/simulation/prepare', {
      method: 'POST',
      json: { simulation_id: validateId(simulationId, 'simulationId') },
    });
  }

  function getPrepareStatus({ taskId, simulationId }) {
    if (!taskId && !simulationId) throw new TypeError('Informe taskId ou simulationId.');
    const json = {};
    if (taskId) json.task_id = validateId(taskId, 'taskId');
    if (simulationId) json.simulation_id = validateId(simulationId, 'simulationId');
    return request('/api/simulation/prepare/status', { method: 'POST', json });
  }

  function startSimulation(simulationId) {
    return request('/api/simulation/start', {
      method: 'POST',
      json: { simulation_id: validateId(simulationId, 'simulationId') },
    });
  }

  function getRunStatus(simulationId) {
    return request('/api/simulation/' + validateId(simulationId, 'simulationId') + '/run-status');
  }

  function generateReport(simulationId) {
    return request('/api/report/generate', {
      method: 'POST',
      json: { simulation_id: validateId(simulationId, 'simulationId') },
    });
  }

  function getReportStatus(reportId) {
    return request('/api/report/generate/status?report_id=' + validateId(reportId, 'reportId'));
  }

  function getReport(reportId) {
    return request('/api/report/' + validateId(reportId, 'reportId'));
  }

  return Object.freeze({
    generateOntologyFromText,
    buildGraph,
    getGraphTask,
    createSimulation,
    prepareSimulation,
    getPrepareStatus,
    startSimulation,
    getRunStatus,
    generateReport,
    getReportStatus,
    getReport,
  });
}
