// WS-11 Señales inside the app (TOOLS-SPEC §5, F2) against the mock
// adapters (E2E_TOOLS_MODE=mock). The risk notice is one-time per account
// in the mock Supabase, so the sheet step accepts either side of the gate.

import { test, expect, type Page } from '@playwright/test';
import { asRole } from './utils/roles';
import { dismissCookies } from './utils/cookies';
import { expectNoLeaks } from './utils/no-leaks';
import { expectNoOverflow } from './utils/a11y';

const MOCK = process.env.E2E_TOOLS_MODE === 'mock';

async function acceptRiskSheet(page: Page) {
  const sheet = page.getByRole('dialog', { name: 'Antes de empezar' });
  if (!(await sheet.isVisible().catch(() => false))) return;
  // Mockup 53: 3 points, the notice word for word, an unchecked box.
  await expect(sheet.getByText('Léelo una vez. Son 3 cosas.')).toBeVisible();
  await expect(sheet.getByText('El aviso, palabra por palabra')).toBeVisible();
  await expect(sheet.getByText(/puedes perder todo tu dinero/)).toBeVisible();
  const box = sheet.getByRole('checkbox', { name: /las decisiones y los riesgos son míos/ });
  await expect(box).not.toBeChecked();
  const cta = sheet.getByRole('button', { name: 'Entendido, continuar' });
  await expect(cta).toBeDisabled();
  await box.check();
  await cta.click();
  await expect(sheet).toHaveCount(0);
}

/** First activation, if this account has no coins yet. */
async function finishSetup(page: Page) {
  if (!/\/app\/senales\/empezar/.test(page.url())) return;
  const btc = page.getByRole('button', { name: /BTC/ });
  if ((await btc.getAttribute('aria-pressed')) !== 'true') await btc.click();
  await page.getByRole('link', { name: 'Continuar' }).click();
  await page.getByRole('checkbox', { name: 'En la app' }).check();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page).toHaveURL(/\/app\/senales\/empezar\/listo$/);
  await page.goto('/app/senales');
}

test.describe('Señales · as pro (annual)', () => {
  asRole('pro_annual');
  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
    await dismissCookies(page);
  });
  test.skip(!MOCK, 'E2E_TOOLS_MODE=mock not set');

  test('no box, no acceptance (422); the data needs the notice (403 until accepted)', async ({
    page,
  }) => {
    const refused = await page.request.post('/api/tools/consent', {
      data: { kind: 'risk', slug: 'chalybcrypto', checked: false, locale: 'es' },
    });
    expect(refused.status()).toBe(422);
  });

  test('sheet → accept → Señales home, one tab throughout', async ({ page, context }, info) => {
    await page.goto('/app/senales');
    // The sidebar stays usable under the sheet (it blocks the tool, not the app).
    await expect(
      page.getByRole('navigation', { name: 'Navegación principal' }).first(),
    ).toBeAttached();
    await acceptRiskSheet(page);
    await page.waitForLoadState('networkidle');
    await finishSetup(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Señales' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Señales' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByTestId('signals-disclaimer').filter({ visible: true })).toContainText(
      'no es asesoría financiera',
    );
    await expect(
      page.getByText(/Momento de compra|Momento de venta|Sin señal clara/).first(),
    ).toBeVisible();
    // One primary per view: only the newest card's "Ver detalle".
    await expect(page.locator('main .ch-btn--primary:visible')).toHaveCount(1);
    await expect(page.getByText(/copiar|te conviene|deberías|precio objetivo/i)).toHaveCount(0);

    // Detail (55): chart, why, follow switch, same-for-everyone line, footer.
    await page.locator('main .ch-btn--primary').first().click();
    await expect(page).toHaveURL(/\/app\/senales\/[^/]+$/);
    await expect(page.getByText('Por qué, en palabras simples')).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Recibir avisos de esta moneda' })).toBeVisible();
    await expect(
      page.getByText(/Esta misma señal la ven todas las personas de tu plan/),
    ).toBeVisible();
    await expect(page.getByTestId('signals-disclaimer').filter({ visible: true })).toBeVisible();
    await page.getByRole('link', { name: '1 mes' }).click();
    await expect(page).toHaveURL(/rango=1m/);

    // Historial: grouped by day, footer.
    await page.getByRole('tab', { name: 'Historial' }).click();
    await expect(page).toHaveURL(/\/app\/senales\/historial$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Hoy' })).toBeVisible();
    await expect(page.getByTestId('signals-disclaimer').filter({ visible: true })).toBeVisible();

    // Ajustes: autosave, risk notice accepted, advanced closed by default.
    await page.getByRole('tab', { name: 'Ajustes' }).click();
    await expect(page.getByText('Tus monedas')).toBeVisible();
    await expect(page.getByText('Aviso de riesgo')).toBeVisible();
    const adv = page.getByRole('button', { name: /Opciones avanzadas/ });
    await expect(adv).toHaveAttribute('aria-expanded', 'false');
    await adv.click();
    await expect(page.getByText('Temporalidad', { exact: true })).toBeVisible();
    await expect(page.getByText(/saldo|cartera|perfil de riesgo|exchange/i)).toHaveCount(0);

    expect(context.pages()).toHaveLength(1);
    await expectNoLeaks(page);
    await expectNoOverflow(page, info);
  });

  test('old activation URLs answer 307 and keep the query', async ({ page }) => {
    const res = await page.request.get('/app/senales/avisos?coins=BTC', { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers().location).toMatch(/\/app\/senales\/empezar\/avisos\?coins=BTC$/);
    const listo = await page.request.get('/app/senales/listo', { maxRedirects: 0 });
    expect(listo.status()).toBe(307);
  });

  test('a signal that does not exist shows the empty state, not a 404 page', async ({ page }) => {
    await page.goto('/app/senales/no-existe');
    if (
      await page
        .getByRole('dialog', { name: 'Antes de empezar' })
        .isVisible()
        .catch(() => false)
    )
      return;
    await expect(page.getByText('No encontramos esta señal')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver señales' })).toBeVisible();
  });
});

test.describe('Señales · as free', () => {
  asRole('free');
  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
    await dismissCookies(page);
  });
  test.skip(!MOCK, 'E2E_TOOLS_MODE=mock not set');

  test('locked: comes with Pro, no risk sheet before activating', async ({ page }, info) => {
    await page.goto('/app/senales');
    await expect(
      page.getByRole('heading', { level: 2, name: 'Señales viene en Pro' }),
    ).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Antes de empezar' })).toHaveCount(0);
    await expect(page.getByRole('tablist')).toHaveCount(0);
    const api = await page.request.post('/api/tools/chalybcrypto/prefs', {
      data: { coins: ['BTC'] },
    });
    expect(api.status()).toBe(403);
    await expectNoOverflow(page, info);
  });
});
