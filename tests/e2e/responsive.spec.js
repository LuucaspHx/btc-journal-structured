import { expect, test } from '@playwright/test';

const STORAGE_KEY = 'btc_journal_state_v3';
const SECTION_NAMES = ['Gráfico', 'Resumo', 'Novo aporte', 'Transações', 'Auditoria', 'Metas', 'Security'];
const VIEWPORTS = [
  { name: 'mobile-320', width: 320, height: 720, touch: true },
  { name: 'mobile-390', width: 390, height: 844, touch: true },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'landscape-844', width: 844, height: 390 },
  { name: 'desktop-1024', width: 1024, height: 768 },
  { name: 'desktop-1440', width: 1440, height: 900 },
];

const stateFixture = {
  txs: [
    {
      id: 'responsive-smoke-entry',
      schemaVersion: 3,
      date: '2026-01-15',
      sats: 150_000,
      btcAmount: 0.0015,
      btcPrice: 50_000,
      price: 50_000,
      fiatAmount: 75,
      fiat: 75,
      fiatCurrency: 'USD',
      fee: 1,
      type: 'buy',
      exchange: 'Exchange com nome propositalmente longo',
      strategy: 'acumulacao-de-longo-prazo',
      tags: ['cold-storage', 'long-term'],
      note: 'Nota extensa para exercer a largura real da tabela de transacoes no mobile.',
      txid: '',
      wallet: '',
      status: 'manual',
      metadata: {},
      createdAt: '2026-01-15T12:00:00.000Z',
      updatedAt: '2026-01-15T12:00:00.000Z',
    },
  ],
  goals: {
    list: [],
    activeGoalId: null,
    lastComputedAt: null,
  },
  vs: 'usd',
};

async function installDeterministicData(page) {
  await page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key: STORAGE_KEY, value: stateFixture }
  );

  await page.route('https://api.coingecko.com/**', async (route) => {
    const url = new URL(route.request().url());
    const now = Date.UTC(2026, 0, 15);
    let body;

    if (url.pathname.endsWith('/simple/price')) {
      body = { bitcoin: { usd: 64_000, eur: 59_000, brl: 350_000 } };
    } else if (url.pathname.endsWith('/ohlc')) {
      body = [
        [now - 86_400_000, 62_000, 64_000, 61_000, 63_000],
        [now, 63_000, 65_000, 62_500, 64_000],
      ];
    } else if (url.pathname.endsWith('/history')) {
      body = { market_data: { current_price: { usd: 64_000, eur: 59_000, brl: 350_000 } } };
    } else {
      body = {
        prices: [
          [now - 86_400_000, 63_000],
          [now, 64_000],
          [now + 86_400_000, 64_500],
        ],
      };
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

async function assertNoPageOverflow(page, context) {
  const metrics = await page.evaluate(() => ({
    bodyClientWidth: document.body.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    rootClientWidth: document.documentElement.clientWidth,
    rootScrollWidth: document.documentElement.scrollWidth,
  }));

  expect(metrics.bodyScrollWidth, `${context}: body overflow`).toBeLessThanOrEqual(
    metrics.bodyClientWidth
  );
  expect(metrics.rootScrollWidth, `${context}: root overflow`).toBeLessThanOrEqual(
    metrics.rootClientWidth
  );
}

async function assertTouchTargets(page, context) {
  const undersized = await page.evaluate(() => {
    const selector = [
      'button:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"])',
      'summary',
      '.import-trigger',
    ].join(',');

    return Array.from(document.querySelectorAll(selector))
      .filter((element) => {
        if (element.closest('[hidden], details:not([open])')) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.pointerEvents !== 'none' &&
          rect.width > 0 &&
          rect.height > 0
        );
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          id: element.id,
          label: element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter(({ width, height }) => width < 44 || height < 44);
  });

  expect(undersized, `${context}: touch targets menores que 44px`).toEqual([]);
}

for (const viewport of VIEWPORTS) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('mantem todas as secoes dentro do viewport', async ({ page }) => {
      const runtimeErrors = [];
      page.on('console', (message) => {
        if (message.type() === 'error') runtimeErrors.push(message.text());
      });
      page.on('pageerror', (error) => runtimeErrors.push(error.message));

      await installDeterministicData(page);
      await page.goto('/index.html');
      await expect(page.getByRole('heading', { name: 'BTC Journal' })).toBeVisible();

      for (const section of SECTION_NAMES) {
        await page.getByRole('button', { name: section, exact: true }).click();
        await page.waitForTimeout(section === 'Gráfico' ? 350 : 50);
        await assertNoPageOverflow(page, `${viewport.name}/${section}`);
        if (viewport.touch) await assertTouchTargets(page, `${viewport.name}/${section}`);
      }

      expect(runtimeErrors).toEqual([]);
    });
  });
}


test('Security Center carrega exemplo sem alterar o estado financeiro', async ({ page }) => {
  await installDeterministicData(page);
  await page.goto('/index.html');

  const before = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);

  await page.getByRole('button', { name: 'Security', exact: true }).click();
  await page.getByRole('button', { name: 'Carregar exemplo', exact: true }).click();

  await expect(page.locator('#securityTarget')).toHaveText('btcjournal.app');
  await expect(page.locator('#securitySubdomainCount')).toHaveText('3');
  await expect(page.locator('#securityServiceCount')).toHaveText('3');

  const after = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  expect(after).toBe(before);
});

test('o comando partilhado de exportacao abre o modal canonico', async ({ page }) => {
  await installDeterministicData(page);
  await page.goto('/index.html');

  await page.getByRole('button', { name: 'Exportar JSON', exact: true }).click();

  const modal = page.getByRole('dialog').filter({ hasText: 'Exportar JSON' });
  await expect(modal).toBeVisible();
  await expect(page.locator('#exportPreview')).toHaveValue(/"txs"/);
});
