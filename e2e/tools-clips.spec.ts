// WS-11 · Clips inside the app (TOOLS-SPEC §4, mockups 50–52) against the
// mock adapter: the server runs TOOL_HUB_MODE_CHALYBCLIP=mock, this spec
// E2E_CLIPS_MODE=mock. Mock jobs are ready ~5 s after they start.
//
// Throughout: one tab only (§10), one primary button per view, sidebar and
// tool header with ≤ 3 tabs.

import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { asRole } from './utils/roles';
import { dismissCookies } from './utils/cookies';
import { expectAccessible, expectNoOverflow } from './utils/a11y';

const MOCK = process.env.E2E_CLIPS_MODE === 'mock';

async function oneTab(context: BrowserContext) {
  expect(context.pages(), 'nothing opens another tab (§0.1)').toHaveLength(1);
}

/** Visible primary buttons outside list cards: exactly one per view. */
async function expectOnePrimary(page: Page) {
  const n = await page
    .locator('main .ch-btn--primary:visible')
    .evaluateAll((els) => els.filter((e) => !e.closest('.ch-clipcard, .ch-risk')).length);
  expect(n, `primary buttons on ${page.url()}`).toBe(1);
}

async function expectToolChrome(page: Page, selected: string) {
  await expect(page.getByRole('heading', { level: 1, name: 'Clips' })).toBeVisible();
  await expect(page.getByText('Incluido en tu plan')).toBeVisible();
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(3);
  await expect(page.getByRole('tab', { name: selected })).toHaveAttribute('aria-selected', 'true');
}

/** Start a job through the wizard and wait for its clips. */
async function makeReadyClips(page: Page, v: string) {
  await page.goto('/app/clips/nuevo');
  await page.getByLabel(/Pega el enlace/).fill(`https://www.youtube.com/watch?v=${v}`);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Crear mis clips' }).click();
  await expect(page.getByRole('heading', { name: /Tus clips están listos/ })).toBeVisible({
    timeout: 30_000,
  });
}

test.describe('as pro', () => {
  asRole('pro');
  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
    await dismissCookies(page);
  });
  test.skip(!MOCK, 'E2E_CLIPS_MODE=mock not set (server must run TOOL_HUB_MODE_CHALYBCLIP=mock)');

  test('home: one primary, in progress row, then latest clips', async ({ page, context }, info) => {
    await page.goto('/app/clips/nuevo');
    await page
      .getByLabel(/Pega el enlace/)
      .fill('https://www.youtube.com/watch?v=torneo-del-sabado');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Crear mis clips' }).click();
    await expect(page).toHaveURL(/\/app\/clips\/trabajo\/[^/?]+$/);

    await page.goto('/app/clips');
    await expectToolChrome(page, 'Hacer clips');
    await expect(page.getByRole('link', { name: 'Hacer clips nuevos' })).toBeVisible();
    // Either still working (the row) or already done (the grid).
    await expect(
      page
        .getByText('Clips de “torneo del sabado”')
        .or(page.getByRole('heading', { name: 'Tus últimos clips' }))
        .first(),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tus últimos clips' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('link', { name: /Ver todos \(\d+\)/ })).toBeVisible();
    await expect(page.locator('.ch-clipcard')).not.toHaveCount(0);
    await expectOnePrimary(page);
    await oneTab(context);
    await expectNoOverflow(page, info);
    await expectAccessible(page);
  });

  test('a failed job stays on the home in amber, charges nothing, can retry', async ({ page }) => {
    await page.goto('/app/clips/nuevo');
    await page.getByLabel(/Pega el enlace/).fill('https://www.youtube.com/watch?v=private-home');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Crear mis clips' }).click();
    await expect(page.getByRole('heading', { name: 'No pudimos leer ese enlace' })).toBeVisible({
      timeout: 30_000,
    });
    await page.goto('/app/clips');
    // Desktop and mobile share the mock store: each adds one failed job.
    const row = page.locator('.ch-jobrow--failed', { hasText: 'private home' }).first();
    await expect(row.getByText('No pudimos terminar “private home”.')).toBeVisible();
    await expect(row.getByText(/No se usaron créditos\./)).toBeVisible();
    await row.getByRole('button', { name: 'Intentar otra vez' }).click();
    await expect(page).toHaveURL(/\/app\/clips$/);
  });

  test('Mis clips: format chips and search', async ({ page, context }, info) => {
    await makeReadyClips(page, 'mis-clips');
    await page.goto('/app/clips');
    await page.getByRole('tab', { name: 'Mis clips' }).click();
    await expect(page).toHaveURL(/\/app\/clips\/mis-clips$/);
    await expectToolChrome(page, 'Mis clips');
    await expect(page.getByRole('link', { name: 'Todos' })).toHaveAttribute('aria-current', 'true');
    await page.getByRole('link', { name: 'Cuadrado' }).click();
    await expect(page).toHaveURL(/f=square/);
    // Another test may have made a clip square (shared mock store).
    await expect(
      page.getByText('No hay clips con ese filtro.').or(page.locator('.ch-clipgrid')).first(),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Vertical' }).click();
    await expect(page.locator('.ch-clipcard').first()).toBeVisible();
    await page.getByRole('searchbox', { name: 'Buscar en mis clips' }).fill('jugada');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/q=jugada/);
    // Titles may have been edited by the detail test (shared mock store).
    await expect(
      page
        .locator('.ch-clipcard', { hasText: /jugada/i })
        .or(page.getByText('No hay clips con ese filtro.'))
        .first(),
    ).toBeVisible();
    await oneTab(context);
    await expectNoOverflow(page, info);
    await expectAccessible(page);
  });

  test('detail: edit title, trim with the keyboard, change format, download in 1 tap', async ({
    page,
    context,
  }, info) => {
    await makeReadyClips(page, 'detalle');
    await page.goto('/app/clips/mis-clips');
    await page.getByRole('link', { name: 'Abrir El mejor momento del stream' }).first().click();
    await expect(page).toHaveURL(/\/app\/clips\/[^/]+$/);
    await expectToolChrome(page, 'Mis clips');
    await expect(page.getByText(/Clip \d+ de \d+/)).toBeVisible();

    // "Descargar" without scrolling, at 1440×900 and on the phone.
    const download = page.getByRole('link', { name: 'Descargar' });
    await expect(download).toBeInViewport();
    await expectOnePrimary(page);

    const title = page.getByLabel('Título del clip');
    await title.fill('Mi clip editado');
    await expect(page.getByText(/^Guardado/)).toBeVisible();

    const end = page.getByRole('slider', { name: 'Final del recorte' });
    const before = Number(await end.getAttribute('aria-valuenow'));
    await end.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(end).toHaveAttribute(
      'aria-valuenow',
      String(Math.round((before - 0.1) * 10) / 10),
    );
    await page.keyboard.press('Shift+ArrowLeft');
    await expect(end).toHaveAttribute(
      'aria-valuenow',
      String(Math.round((before - 1.1) * 10) / 10),
    );

    await page.getByRole('radio', { name: 'Cuadrado' }).check();
    await expect(page.getByRole('radio', { name: 'Cuadrado' })).toBeChecked();
    await expect(page.getByText(/^Guardado/)).toBeVisible();

    // Saved on the server: a reload keeps every change.
    await page.reload();
    await expect(page.getByLabel('Título del clip')).toHaveValue('Mi clip editado');
    await expect(page.getByRole('radio', { name: 'Cuadrado' })).toBeChecked();

    const file = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Descargar' }).click();
    await file;
    await oneTab(context);
    await expectNoOverflow(page, info);
    await expectAccessible(page);
  });

  test('a clip that does not exist: a way back, never a blank page', async ({ page }) => {
    await page.goto('/app/clips/no-existe');
    await expect(page.getByRole('heading', { name: 'No encontramos este clip' })).toBeVisible();
    await page.getByRole('link', { name: 'Ver mis clips' }).click();
    await expect(page).toHaveURL(/\/app\/clips\/mis-clips$/);
  });

  test('Ajustes: Amarillo by default, choices save, advanced options in ≤ 2 taps and remembered', async ({
    page,
    context,
  }, info) => {
    await page.goto('/app/clips');
    await page.getByRole('tab', { name: 'Ajustes' }).click(); // tap 1
    await expect(page).toHaveURL(/\/app\/clips\/ajustes$/);
    await expectToolChrome(page, 'Ajustes');
    await expect(page.getByRole('switch', { name: 'Poner subtítulos en mis clips' })).toBeVisible();
    // Whatever another run left, pick Con fondo and see it stick.
    await page.locator('label', { hasText: 'Con fondo' }).click();
    await expect(page.getByRole('radio', { name: /Con fondo/ })).toBeChecked();

    const adv = page.getByRole('button', { name: /Opciones avanzadas/ });
    if ((await adv.getAttribute('aria-expanded')) !== 'true') await adv.click(); // tap 2
    await expect(page.getByLabel('Duración de los clips')).toBeVisible();
    await expect(page.getByLabel('Encuadre')).toBeVisible();
    // Never an AI voice or face here (BUILD-SPEC §11.6).
    await expect(page.getByText(/voz|rostro/i)).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole('radio', { name: /Con fondo/ })).toBeChecked();
    await expect(page.getByRole('button', { name: /Opciones avanzadas/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    // Leave it closed for the next run.
    await page.getByRole('button', { name: /Opciones avanzadas/ }).click();
    await oneTab(context);
    await expectNoOverflow(page, info);
    await expectAccessible(page);
  });

  test('no "Abrir", no "pestaña nueva", no engine words on any Clips screen', async ({ page }) => {
    for (const path of ['/app/clips', '/app/clips/mis-clips', '/app/clips/ajustes']) {
      await page.goto(path);
      const text = await page.locator('main').innerText();
      expect(text, path).not.toMatch(/pestaña nueva|new tab|motor|engine|ChalyClip|token/i);
      expect(await page.locator('main a[target="_blank"]').count(), path).toBe(0);
    }
  });
});

test.describe('as free', () => {
  asRole('free');
  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
    await dismissCookies(page);
  });
  test.skip(!MOCK, 'E2E_CLIPS_MODE=mock not set');

  test('Free cannot connect social accounts or publish (TIER_CAPS)', async ({ page }) => {
    const connect = await page.request.post('/api/tools/chalybclip/connect', {
      data: { platform: 'tiktok', returnTo: '/app/clips', locale: 'es' },
    });
    expect(connect.status()).toBe(403);
    expect((await connect.json()).error.reason).toBe('needs_plan');
    const publish = await page.request.post('/api/tools/chalybclip/clips/any/publish', {
      data: { platform: 'tiktok' },
    });
    expect(publish.status()).toBe(403);
    await page.goto('/app/clips/ajustes');
    await expect(page.getByRole('button', { name: /^Conectar/ })).toHaveCount(0);
  });

  // Gratis does use Clips (TOOLS-SPEC §4.1, Fase 0): no locked state here.
  test('Free gets Clips itself, not an offer', async ({ page, context }) => {
    await page.goto('/app/clips');
    await expectToolChrome(page, 'Hacer clips');
    await expect(page.getByRole('link', { name: 'Hacer clips nuevos' })).toBeVisible();
    await expect(page.getByText(/Clips viene en Pro/)).toHaveCount(0);
    await oneTab(context);
  });
});
