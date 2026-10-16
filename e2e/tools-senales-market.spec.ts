// Señales · Mercado and Estrategias (parity with the engine's old panel),
// against the mock adapter (E2E_TOOLS_MODE=mock). Mode "a" against a real
// engine is exercised by hand (see the PR): it needs the engine running.

import { test, expect, type Page } from '@playwright/test';
import { asRole } from './utils/roles';
import { dismissCookies } from './utils/cookies';
import { expectNoOverflow } from './utils/a11y';

const MOCK = process.env.E2E_TOOLS_MODE === 'mock';

async function ready(page: Page, path: string) {
  await page.goto(path);
  const sheet = page.getByRole('dialog', { name: 'Antes de empezar' });
  await sheet.waitFor({ timeout: 5_000 }).catch(() => {});
  if (await sheet.isVisible().catch(() => false)) {
    await sheet.getByRole('checkbox').check();
    await sheet.getByRole('button', { name: 'Entendido, continuar' }).click();
    await expect(sheet).toHaveCount(0);
    await page.goto(path);
  }
}

test.describe('Señales · Mercado y Estrategias as vip', () => {
  asRole('vip');
  test.skip(!MOCK, 'E2E_TOOLS_MODE=mock not set');
  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
    await dismissCookies(page);
  });

  test('Mercado: chart panels, live book, derivatives, news, pair switch', async ({
    page,
  }, info) => {
    await ready(page, '/app/senales/mercado?par=SOLUSDT');
    await expect(page.getByRole('heading', { level: 2, name: 'Mercado' })).toBeVisible();
    await expect(page.getByText('Gráfica de SOLUSDT')).toBeVisible();
    for (const name of ['RSI (14)', 'MACD (12, 26, 9)', 'ADX (14)', 'Delta de volumen'])
      await expect(page.locator('.ch-mkt-panel__h b', { hasText: name })).toBeVisible();
    await expect(page.getByText(/Se actualiza cada 2 segundos/)).toBeVisible();
    await expect(page.getByText('Interés abierto')).toBeVisible();
    await expect(page.getByText('Noticias de SOL')).toBeVisible();
    // News opens in the same tab.
    const link = page.locator('.ch-mkt-news a').first();
    await expect(link).not.toHaveAttribute('target', '_blank');
    await page.getByRole('button', { name: 'ETH', exact: true }).click();
    await expect(page).toHaveURL(/par=ETHUSDT/);
    await expect(page.getByText('Gráfica de ETHUSDT')).toBeVisible();
    await page.getByRole('button', { name: '1 h', exact: true }).click();
    await expect(page.getByRole('button', { name: '1 h', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByTestId('signals-disclaimer').filter({ visible: true })).toBeVisible();
    await expectNoOverflow(page, info);
  });

  test('Estrategias: run a backtest, see its result, then the out-of-credits state', async ({
    page,
  }, info) => {
    await ready(page, '/app/senales/estrategias');
    await expect(page.getByText('EMA/ADX trend').first()).toBeVisible();
    await expect(page.getByText('OPTIMISTA').first()).toBeVisible();
    await page.getByRole('button', { name: 'Probar', exact: true }).click();
    await expect(page.locator('.ch-lab-latest').getByText(/Resultado neto simulado/)).toBeVisible();
    // The mock refuses 5000 bars as "no_tokens".
    await page.getByLabel('Velas').fill('5000');
    await page.getByRole('button', { name: 'Probar', exact: true }).click();
    await expect(page.getByText('Te quedaste sin créditos para esta prueba.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver mi uso' })).toHaveAttribute(
      'href',
      /\/app\/usage$/,
    );
    await expectNoOverflow(page, info);
  });
});
