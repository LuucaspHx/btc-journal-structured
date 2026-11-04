import { expect, test } from '@playwright/test';

const path = '/labs/mirofish/index.html';

test('Scenario Lab abre em mobile sem rede, sem acessar a carteira e sem overflow', async ({ page }) => {
  let apiCalls = 0;
  await page.route('**/mirofish/api/**', async (route) => {
    apiCalls += 1;
    await route.abort();
  });
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    await page.goto(path);
    await expect(page.getByRole('heading', { name: /Imagine um evento/ })).toBeVisible();
    await expect(page.locator('#buildGraphBtn')).toBeDisabled();
    await expect(page.locator('#scenarioConsent')).not.toBeChecked();
    const metrics = await page.evaluate(() => ({
      bodyScroll: document.body.scrollWidth,
      bodyWidth: document.body.clientWidth,
      rootScroll: document.documentElement.scrollWidth,
      rootWidth: document.documentElement.clientWidth,
    }));
    expect(metrics.bodyScroll).toBeLessThanOrEqual(metrics.bodyWidth);
    expect(metrics.rootScroll).toBeLessThanOrEqual(metrics.rootWidth);
    expect(await page.evaluate(() => localStorage.getItem('btc_journal_state_v3'))).toBeNull();
  }
  expect(apiCalls).toBe(0);
});

test('Scenario Lab exige consentimento antes de enviar o contexto', async ({ page }) => {
  let requests = 0;
  await page.route('**/mirofish/api/**', async (route) => {
    requests += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
  });
  await page.goto(path);
  await page.locator('#scenarioSeed').fill('Contexto público totalmente fictício.');
  await page.locator('#createContextBtn').click();
  expect(requests).toBe(0);
  await expect(page.locator('#scenarioConsent')).not.toBeChecked();
});

test('Scenario Lab percorre fluxo simulado no E2E apenas com respostas MOCK da API', async ({ page }) => {
  const called = [];
  const text = '# Análise hipotética\n<script>window.injected = true</script>';
  await page.route('**/mirofish/api/**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.replace(/^\/mirofish/, '');
    called.push({ endpoint, method: route.request().method() });
    const responses = {
      '/api/graph/ontology/generate': { project_id: 'proj_e2e' },
      '/api/graph/build': { task_id: 'task_graph' },
      '/api/graph/task/task_graph': { status: 'completed', progress: 100, result: { graph_id: 'graph_e2e' } },
      '/api/simulation/create': { simulation_id: 'sim_e2e' },
      '/api/simulation/prepare': { status: 'preparing', task_id: 'task_prepare' },
      '/api/simulation/prepare/status': { status: 'ready', progress: 100 },
      '/api/simulation/start': { runner_status: 'running' },
      '/api/simulation/sim_e2e/run-status': { runner_status: 'completed', progress_percent: 100 },
      '/api/report/generate': { status: 'generating', task_id: 'task_report', report_id: 'report_e2e' },
      '/api/report/generate/status': { status: 'completed', progress: 100, result: { report_id: 'report_e2e' } },
      '/api/report/report_e2e': { markdown_content: text },
    };
    const data = responses[endpoint];
    if (!data) throw new Error('Rota inesperada no teste: ' + endpoint);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    });
  });

  await page.goto(path);
  await page.locator('#scenarioSeed').fill('Evento BTC hipotético sem qualquer dado pessoal.');
  await page.locator('#scenarioConsent').check();
  await page.locator('#createContextBtn').click();
  await expect(page.locator('#projectId')).toHaveText('proj_e2e');
  await page.locator('#buildGraphBtn').click();
  await expect(page.locator('#refreshGraphBtn')).toBeEnabled();
  await page.locator('#refreshGraphBtn').click();
  await expect(page.locator('#graphId')).toHaveText('graph_e2e');
  await page.locator('#createSimulationBtn').click();
  await expect(page.locator('#simulationId')).toHaveText('sim_e2e');
  await page.locator('#prepareSimulationBtn').click();
  await page.locator('#refreshPrepareBtn').click();
  await expect(page.locator('#startSimulationBtn')).toBeEnabled();
  await page.locator('#startSimulationBtn').click();
  await page.locator('#refreshRunBtn').click();
  await expect(page.locator('#generateReportBtn')).toBeEnabled();
  await page.locator('#generateReportBtn').click();
  await page.locator('#refreshReportBtn').click();
  await page.locator('#loadReportBtn').click();
  await expect(page.locator('#reportPanel')).toBeVisible();
  await expect(page.locator('#reportBody')).toHaveText(text);
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
  expect(await page.evaluate(() => localStorage.getItem('btc_journal_state_v3'))).toBeNull();
  expect(called.find((call) => call.endpoint === '/api/report/generate/status')).toMatchObject({ method: 'POST' });
  expect(called).toHaveLength(11);
});
