import { createMiroFishClient } from '../../js/integrations/mirofish-client.js';
import { createMiroFishFlow } from '../../js/integrations/mirofish-flow.js';

const byId = (id) => document.getElementById(id);
const feedback = byId('feedback');
const form = byId('scenarioForm');
const reportPanel = byId('reportPanel');
const reportBody = byId('reportBody');

function showFeedback(message, type = '') {
  feedback.textContent = message;
  feedback.className = 'feedback' + (type ? ' ' + type : '');
}

function statusLabel(id, text, kind = '') {
  const node = byId(id);
  node.textContent = text;
  node.className = 'status' + (kind ? ' ' + kind : '');
}

function setProgress(id, number) {
  byId(id).value = Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : 0;
}

function render(state) {
  const idle = !state.busy;
  const hasProject = Boolean(state.projectId);
  const hasGraph = Boolean(state.graphId);
  const hasSimulation = Boolean(state.simulationId);
  const graphBuilding = Boolean(state.graphTaskId) && !hasGraph;
  const preparing = Boolean(state.prepareTaskId) && !state.prepared;
  const running = state.runStarted && !state.runComplete;
  const reporting = Boolean(state.reportTaskId) && !state.reportReady;

  byId('createContextBtn').disabled = !idle || hasProject;
  for (const field of form.querySelectorAll('input, textarea')) field.disabled = hasProject || !idle;

  const enabled = {
    buildGraphBtn: hasProject && !state.graphTaskId,
    refreshGraphBtn: graphBuilding,
    createSimulationBtn: hasGraph && !hasSimulation,
    prepareSimulationBtn: hasSimulation && !state.prepareTaskId && !state.prepared,
    refreshPrepareBtn: preparing,
    startSimulationBtn: state.prepared && !state.runStarted,
    refreshRunBtn: running,
    generateReportBtn: state.runComplete && !state.reportTaskId && !state.reportReady,
    refreshReportBtn: reporting,
    loadReportBtn: state.reportReady && Boolean(state.reportId) && !state.reportText,
    copyIdsBtn: hasProject,
  };
  for (const [id, allowed] of Object.entries(enabled)) byId(id).disabled = !idle || !allowed;

  statusLabel('graphStatus', hasGraph ? 'Concluído' : graphBuilding ? state.graphStatus || 'Pendente' : hasProject ? 'Pronto' : 'Bloqueado', hasGraph ? 'done' : graphBuilding ? 'live' : '');
  statusLabel('prepareStatus', state.prepared ? 'Preparado' : preparing ? state.prepareStatus || 'Pendente' : hasSimulation ? 'Pronto' : 'Bloqueado', state.prepared ? 'done' : preparing ? 'live' : '');
  statusLabel('runStatus', state.runComplete ? 'Concluído' : running ? state.runStatus || 'Executando' : state.prepared ? 'Pronto' : 'Bloqueado', state.runComplete ? 'done' : running ? 'live' : '');
  statusLabel('reportStatus', state.reportReady ? 'Pronto' : reporting ? state.reportStatus || 'Gerando' : state.runComplete ? 'Pronto' : 'Bloqueado', state.reportReady ? 'done' : reporting ? 'live' : '');

  setProgress('graphProgress', state.graphProgress);
  setProgress('prepareProgress', state.prepareProgress);
  setProgress('runProgress', state.runProgress);
  setProgress('reportProgress', state.reportProgress);

  byId('projectId').textContent = state.projectId || '—';
  byId('graphId').textContent = state.graphId || '—';
  byId('simulationId').textContent = state.simulationId || '—';
  byId('reportId').textContent = state.reportId || '—';

  if (state.reportText) {
    reportPanel.hidden = false;
    // Nunca interpretar HTML/Markdown de uma resposta do modelo como código.
    reportBody.textContent = state.reportText;
  }

  if (state.error) {
    showFeedback(state.error + ' Verifique a instalação privada do MiroFish e a configuração do gateway.', 'error');
  } else if (state.busy) {
    showFeedback(state.action + '…');
  } else if (state.reportText) {
    showFeedback('Relatório carregado. O conteúdo representa apenas uma simulação hipotética.', 'success');
  } else if (state.projectId) {
    showFeedback('Sessão ativa. Execute a próxima etapa manualmente ou consulte seu progresso.', 'success');
  }
}

const client = createMiroFishClient();
const flow = createMiroFishFlow(client, render);

async function execute(fn) {
  try {
    await fn();
  } catch {
    // O próprio fluxo já exibe um erro seguro em #feedback.
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  if (!byId('scenarioConsent').checked) return;
  void execute(() => flow.createContext({
    projectName: byId('scenarioName').value,
    requirement: byId('scenarioQuestion').value,
    seedText: byId('scenarioSeed').value,
  }));
});

const actions = {
  buildGraphBtn: () => flow.buildGraph(),
  refreshGraphBtn: () => flow.refreshGraph(),
  createSimulationBtn: () => flow.createSimulation(),
  prepareSimulationBtn: () => flow.prepareSimulation(),
  refreshPrepareBtn: () => flow.refreshPreparation(),
  startSimulationBtn: () => flow.startSimulation(),
  refreshRunBtn: () => flow.refreshRun(),
  generateReportBtn: () => flow.generateReport(),
  refreshReportBtn: () => flow.refreshReport(),
  loadReportBtn: () => flow.loadReport(),
};
for (const [id, action] of Object.entries(actions)) {
  byId(id).addEventListener('click', () => void execute(action));
}

byId('copyIdsBtn').addEventListener('click', async () => {
  const state = flow.snapshot();
  const ids = [
    'project_id=' + state.projectId,
    'graph_task_id=' + state.graphTaskId,
    'graph_id=' + state.graphId,
    'simulation_id=' + state.simulationId,
    'prepare_task_id=' + state.prepareTaskId,
    'report_task_id=' + state.reportTaskId,
    'report_id=' + state.reportId,
  ].join('\n');
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard indisponível');
    await navigator.clipboard.writeText(ids);
    showFeedback('IDs de sessão copiados. Não compartilhe identificadores em público.', 'success');
  } catch {
    showFeedback('Não foi possível copiar automaticamente. Os IDs estão visíveis acima.', 'error');
  }
});
