// WS-11 PR screenshots (TOOLS-SPEC §10): every tool screen at 1440×900 and
// 390×844, committed under docs/qa/tools/. Opt-in, mock adapters:
//   E2E_TOOL_SHOTS=1 pnpm e2e e2e/tools-screens.spec.ts --project=desktop-chromium
// Detail screens are reached by clicking the first item, so the spec doesn't
// depend on mock ids.

import { test, type Page } from '@playwright/test';
import { asRole } from './utils/roles';

const shoot = process.env.E2E_TOOL_SHOTS === '1';
const SIZES = [
  { tag: '1440', width: 1440, height: 900 },
  { tag: '390', width: 390, height: 844 },
] as const;

async function snap(page: Page, file: string) {
  for (const s of SIZES) {
    await page.setViewportSize({ width: s.width, height: s.height });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `docs/qa/tools/${file}-${s.tag}.png` });
  }
}

/** Accept the one-time risk notice if it's showing, after capturing it. */
async function passRisk(page: Page, shotFirst: boolean) {
  const sheet = page.getByRole('dialog', { name: 'Antes de empezar' });
  if (!(await sheet.isVisible().catch(() => false))) return;
  if (shotFirst) await snap(page, '53-senales-aviso');
  await sheet.getByRole('checkbox').check();
  await sheet.getByRole('button', { name: 'Entendido, continuar' }).click();
  await sheet.waitFor({ state: 'detached' });
}

test.describe('pro', () => {
  test.skip(!shoot, 'E2E_TOOL_SHOTS=1 not set');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'one project sets both sizes');
  });
  asRole('pro');

  test('tool screens', async ({ page }) => {
    test.setTimeout(180_000);
    const go = async (path: string, file: string) => {
      await page.goto(path);
      await passRisk(page, file === '54-senales-home');
      await snap(page, file);
    };
    await go('/app/herramientas', '61-herramientas');
    await go('/app/clips', '50-clips-home');
    await go('/app/clips/mis-clips', '50b-clips-mis-clips');
    const clip = page.locator('a[href*="/app/clips/clip"], a.ch-clipcard').first();
    if (await clip.count()) {
      await clip.click();
      await page.waitForLoadState('networkidle');
      await snap(page, '51-clips-detalle');
    }
    await go('/app/clips/ajustes', '52-clips-ajustes');
    await go('/app/senales', '54-senales-home');
    await go('/app/senales/historial', '54b-senales-historial');
    const sig = page
      .locator('a[href*="/app/senales/"]:not([href$="historial"]):not([href$="ajustes"])')
      .first();
    if (await sig.count()) {
      await sig.click();
      await page.waitForLoadState('networkidle');
      await snap(page, '55-senales-detalle');
    }
    await go('/app/senales/ajustes', '56-senales-ajustes');
    await go('/app/en-vivo', '57-58-envivo');
    await go('/app/en-vivo/transmisiones', '58b-envivo-transmisiones');
    await go('/app/en-vivo/ajustes', '59-envivo-ajustes');
  });
});

test.describe('free', () => {
  test.skip(!shoot, 'E2E_TOOL_SHOTS=1 not set');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'one project sets both sizes');
  });
  asRole('free');

  test('locked states', async ({ page }) => {
    for (const [path, file] of [
      ['/app/herramientas', '61-herramientas-gratis'],
      ['/app/senales', '54-senales-gratis'],
      ['/app/en-vivo', '58-envivo-gratis'],
    ] as const) {
      await page.goto(path);
      await snap(page, file);
    }
  });
});

// Mockup 60: run with the Clips engine off (TOOL_HUB_MODE_CHALYBCLIP=off) and
// E2E_TOOL_SHOTS=error.
test.describe('engine off', () => {
  test.skip(process.env.E2E_TOOL_SHOTS !== 'error', 'E2E_TOOL_SHOTS=error not set');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'one project sets both sizes');
  });
  asRole('pro');

  test('ToolErrorState', async ({ page }) => {
    await page.goto('/app/clips');
    await snap(page, '60-tool-no-abre');
  });
});
