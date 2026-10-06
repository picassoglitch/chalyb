// WS-11 PR screenshots (TOOLS-SPEC §10): every tool screen at 1440×900 and
// 390×844, committed under docs/qa/tools/. Opt-in, mock adapters:
//   E2E_TOOL_SHOTS=1 pnpm e2e e2e/tools-screens.spec.ts --project=desktop-chromium
// Mockup 60 (ToolErrorState) is no longer reachable with the engine off: the
// screen hands off over SSO instead (OPS-13), so its shot is not retaken. The data the screens show is made first (a clip
// job, Señales set up, a computer paired), so nothing depends on mock ids.

import { test, expect, type Page } from '@playwright/test';
import { asRole } from './utils/roles';
import { dismissCookies } from './utils/cookies';

const SIZES = [
  { tag: '1440', width: 1440, height: 900 },
  { tag: '390', width: 390, height: 844 },
] as const;

async function snap(page: Page, file: string) {
  for (const s of SIZES) {
    await page.setViewportSize({ width: s.width, height: s.height });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `docs/qa/tools/${file}-${s.tag}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

/** Open a screen and wait until its tool header (or `ready`) is on screen. */
async function open(page: Page, path: string, ready?: string | RegExp) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  if (ready) await expect(page.getByText(ready).first()).toBeVisible({ timeout: 20_000 });
  else await expect(page.locator('.ch-toolhead, h1').first()).toBeVisible();
}

const onlyDesktop = () =>
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'one project sets both sizes');
    await page.goto('/app');
    await dismissCookies(page);
  });

test.describe('pro', () => {
  test.skip(process.env.E2E_TOOL_SHOTS !== '1', 'E2E_TOOL_SHOTS=1 not set');
  asRole('pro');
  onlyDesktop();

  test('Clips', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/app/clips/nuevo');
    await page.getByLabel(/Pega el enlace/).fill('https://www.youtube.com/watch?v=torneo-del-sabado');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Crear mis clips' }).click();
    await expect(page.getByRole('heading', { name: /Tus clips están listos/ })).toBeVisible({
      timeout: 30_000,
    });
    await open(page, '/app/clips', 'Tus últimos clips');
    await snap(page, '50-clips-home');
    await open(page, '/app/clips/mis-clips');
    await snap(page, '50b-clips-mis-clips');
    await page.locator('.ch-clipcard a').first().click();
    await expect(page.getByText(/Clip \d+ de \d+/)).toBeVisible();
    await page.waitForLoadState('networkidle');
    await snap(page, '51-clips-detalle');
    await open(page, '/app/clips/ajustes');
    await snap(page, '52-clips-ajustes');
  });

  test('Señales', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/app/senales');
    const sheet = page.getByRole('dialog', { name: 'Antes de empezar' });
    await sheet.waitFor({ timeout: 10_000 }).catch(() => {});
    if (await sheet.isVisible()) {
      await snap(page, '53-senales-aviso');
      await sheet.getByRole('checkbox').check();
      await sheet.getByRole('button', { name: 'Entendido, continuar' }).click();
      await expect(sheet).toHaveCount(0);
    }
    await page.goto('/app/senales/empezar');
    const btc = page.getByRole('button', { name: /BTC/ });
    await btc.waitFor({ timeout: 5_000 }).catch(() => {});
    if (await btc.isVisible().catch(() => false)) {
      if ((await btc.getAttribute('aria-pressed')) !== 'true') await btc.click();
      await page.getByRole('link', { name: 'Continuar' }).click();
      await page.getByRole('checkbox', { name: 'En la app' }).check();
      await page.getByRole('button', { name: 'Continuar' }).click();
      await expect(page).toHaveURL(/listo$/);
    }
    await open(page, '/app/senales', /Momento de compra|Momento de venta|Sin señal clara/);
    await snap(page, '54-senales-home');
    await page.locator('main .ch-btn--primary').first().click();
    await expect(page.getByText('Por qué, en palabras simples')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await snap(page, '55-senales-detalle');
    await open(page, '/app/senales/historial', 'Hoy');
    await snap(page, '54b-senales-historial');
    await open(page, '/app/senales/ajustes', 'Tus monedas');
    await snap(page, '56-senales-ajustes');
  });

  test('En vivo', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/app/en-vivo');
    const setup = page.getByRole('heading', { name: 'Conecta tu computadora' });
    await setup.waitFor({ timeout: 5_000 }).catch(() => {});
    if (await setup.isVisible().catch(() => false)) {
      await snap(page, '57-envivo-conectar');
      await expect(page.getByText('¡Listo! Tu computadora está conectada.')).toBeVisible({
        timeout: 20_000,
      });
    }
    await expect(page.getByRole('button', { name: /Iniciar transmisión|Terminar transmisión/ })).toBeVisible({
      timeout: 20_000,
    });
    const stop = page.getByRole('button', { name: /Terminar transmisión/ });
    if (await stop.isVisible().catch(() => false)) {
      await stop.click();
      await page.getByRole('button', { name: 'Sí, terminar' }).click();
      await page.goto('/app/en-vivo');
    }
    await expect(page.getByRole('button', { name: /Iniciar transmisión/ })).toBeVisible();
    await snap(page, '22-envivo-antes');
    await page.getByRole('button', { name: /Iniciar transmisión/ }).click();
    await expect(page.getByRole('timer')).toBeVisible({ timeout: 20_000 });
    await snap(page, '58-envivo-control');
    await page.getByRole('button', { name: /Terminar transmisión/ }).click();
    await page.getByRole('button', { name: 'Sí, terminar' }).click();
    await open(page, '/app/en-vivo/transmisiones');
    await snap(page, '58b-envivo-transmisiones');
    await open(page, '/app/en-vivo/ajustes', 'Dónde transmites');
    await snap(page, '59-envivo-ajustes');
  });

  test('Tus herramientas', async ({ page }) => {
    await open(page, '/app/herramientas', 'Tus herramientas');
    await snap(page, '61-herramientas');
  });
});

test.describe('free', () => {
  test.skip(process.env.E2E_TOOL_SHOTS !== '1', 'E2E_TOOL_SHOTS=1 not set');
  asRole('free');
  onlyDesktop();

  test('locked states', async ({ page }) => {
    await open(page, '/app/herramientas', 'Tus herramientas');
    await snap(page, '61-herramientas-gratis');
    await open(page, '/app/senales', 'Señales viene en Pro');
    await snap(page, '54-senales-gratis');
    await open(page, '/app/en-vivo', 'En vivo viene en Pro');
    await snap(page, '58-envivo-gratis');
  });
});

test.describe('engine off', () => {
  test.skip(true, 'engine off hands off over SSO now; see clips-launch.spec.ts');
  asRole('pro');
  onlyDesktop();

  test('ToolErrorState', async ({ page }) => {
    await open(page, '/app/clips', 'Clips no abrió esta vez');
    await snap(page, '60-tool-no-abre');
  });
});
