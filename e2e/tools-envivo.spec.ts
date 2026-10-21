// En vivo inside the app (TOOLS-SPEC §6, rebuilt on the engine's model: an
// RTMP relay that re-sends the encoder's signal to the person's channels)
// against the mock adapter (E2E_TOOLS_MODE=mock). The mock keeps its state in
// the server process for the whole run, so each step tolerates what an
// earlier step (or the other viewport) left behind.
//
// The same flows against the real engine (TOOL_HUB_MODE_CHALYBOBS=a) are
// driven by hand: see the hub PR.

import { test, expect, type Page } from '@playwright/test';
import { asRole } from './utils/roles';
import { dismissCookies } from './utils/cookies';
import { expectNoLeaks } from './utils/no-leaks';
import { expectAccessible, expectNoOverflow } from './utils/a11y';

const MOCK = process.env.E2E_TOOLS_MODE === 'mock';

/** "Mostrar" → the password sheet when the sign-in isn't recent. */
async function reveal(page: Page, button: ReturnType<Page['getByRole']>) {
  await button.click();
  const reauth = page.getByRole('dialog', { name: 'Confirma que eres tú' });
  await reauth.waitFor({ timeout: 5_000 }).catch(() => {});
  if (await reauth.isVisible().catch(() => false)) {
    await reauth.getByLabel('Tu contraseña').fill(process.env.E2E_VIP_PASSWORD ?? '');
    await reauth.getByRole('button', { name: 'Mostrar la clave' }).click();
  }
}

test.describe('as vip', () => {
  asRole('vip');
  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
    await dismissCookies(page);
  });
  test.skip(!MOCK, 'E2E_TOOLS_MODE=mock not set (server must run the tools in mock mode)');

  test('Transmitir: encoder data, key only on "Mostrar", channels, titles — one tab', async ({
    page,
    context,
  }, info) => {
    await page.goto('/app/en-vivo');
    await expect(page.getByRole('heading', { level: 1, name: 'En vivo' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Transmitir' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('heading', { name: 'Conecta tu encoder' })).toBeVisible();
    await expect(page.getByLabel('Servidor (RTMP URL)')).toHaveValue(/^rtmp:\/\//);
    const keyField = page.getByLabel('Clave de transmisión', { exact: true });
    await expect(keyField).toHaveValue('••••••••');
    expect(await page.content()).not.toMatch(/chalyb_live_[0-9a-f]{32}/);
    await reveal(page, page.getByRole('button', { name: 'Mostrar' }).first());
    await expect(keyField).toHaveValue(/^chalyb_live_[0-9a-f]{32}$/);

    // A manual channel: needs its key before it can go on.
    const add = page.getByRole('button', { name: 'Agregar canal' });
    if (
      !(await page
        .getByText('Restream', { exact: true })
        .isVisible()
        .catch(() => false))
    ) {
      await add.click();
      await page.getByRole('button', { name: 'Restream' }).click();
    }
    const row = page.locator('.ch-ev-dest', { hasText: 'Restream' }).first();
    await row.getByRole('button', { name: 'Editar' }).click();
    const edit = page.getByRole('dialog', { name: 'Configurar Restream' });
    await edit.getByPlaceholder('Pega aquí la clave de la plataforma').fill('re_live_123');
    await edit.getByRole('button', { name: 'Guardar' }).click();
    await expect(edit).toBeHidden();
    const sw = row.getByRole('switch');
    const was = await sw.getAttribute('aria-checked');
    await sw.click();
    await expect(sw).not.toHaveAttribute('aria-checked', was ?? '');
    expect(await page.content()).not.toContain('re_live_123');

    // "Actualizar títulos" shows which channel takes each field.
    await page.getByRole('button', { name: 'Actualizar títulos' }).click();
    const composer = page.getByRole('dialog', { name: 'Actualizar títulos' });
    await composer.getByLabel('Título').fill('Torneo del sábado');
    await composer.getByRole('button', { name: 'Publicar' }).click();
    await expect(composer).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Torneo del sábado' })).toBeVisible();

    await expectNoLeaks(page);
    await expectNoOverflow(page, info);
    await expectAccessible(page);
    expect(context.pages()).toHaveLength(1);
  });

  test('platform sign-in: consent text first, then back here in the same tab', async ({
    page,
    context,
  }) => {
    await page.goto('/app/en-vivo');
    // Connected rows show the platform handle; the mock signs in as mi_canal.
    const kickRow = page.locator('.ch-ev-dest', { hasText: 'Conectado con tu cuenta' });
    // The list renders with this button; before it, goto may still show the
    // loading screen and a connected Kick (from an earlier run) looks missing.
    await expect(page.getByRole('button', { name: 'Agregar canal' })).toBeVisible();
    if (!(await kickRow.isVisible().catch(() => false))) {
      await page.getByRole('button', { name: 'Agregar canal' }).click();
      await page.getByRole('button', { name: /Kick/ }).click();
      const sheet = page.getByRole('dialog', { name: 'Conectar Kick' });
      await expect(sheet).toContainText('publicar solo cuando tú lo indiques');
      await sheet.getByRole('button', { name: 'Conectar Kick' }).click();
      await expect(page).toHaveURL(/\/app\/en-vivo\?connected=kick$/);
      await expect(page.getByText(/Kick quedó conectada/)).toBeVisible();
    }
    await expect(kickRow.getByText('Conectado con tu cuenta')).toBeVisible();
    // A forged return without the sign-in cookie changes nothing.
    await page.goto(
      '/api/tools/chalybobs/oauth/callback?platform=kick&code=mock-code&state=hub.forgedforgedforged',
    );
    await expect(page).toHaveURL(/connect_error=kick_state_mismatch/);
    expect(context.pages()).toHaveLength(1);
  });

  test('Ajustes: Clips connection and a new key behind a confirmation', async ({ page }, info) => {
    await page.goto('/app/en-vivo/ajustes');
    await expect(page.getByRole('tab', { name: 'Ajustes' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const clips = page.getByRole('switch', { name: 'Mandar a Clips' });
    const was = await clips.getAttribute('aria-checked');
    await clips.click();
    await expect(clips).not.toHaveAttribute('aria-checked', was ?? '');
    await page.getByRole('button', { name: 'Generar una clave nueva' }).click();
    await page
      .getByRole('dialog', { name: '¿Generar una clave nueva?' })
      .getByRole('button', { name: 'Sí, generar' })
      .click();
    await expect(
      page.getByText('Listo: tu clave nueva ya funciona. Pégala en tu encoder.'),
    ).toBeVisible();
    await expect(page.getByLabel('Clave de transmisión', { exact: true })).toHaveValue('••••••••');
    await expectNoOverflow(page, info);
  });

  test('Mis transmisiones and the encoder guide', async ({ page }) => {
    await page.goto('/app/en-vivo/transmisiones');
    await expect(page.getByRole('heading', { name: 'Mis transmisiones' })).toBeVisible();
    await expect(page.getByText(/Duró /).first()).toBeVisible();
    await page.goto('/app/en-vivo/conectar');
    await expect(page.getByText(/OBS Studio:/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ir a Transmitir' })).toBeVisible();
  });

  test('junk request bodies are 400s and never lock the tool for everyone', async ({ page }) => {
    for (let i = 0; i < 7; i++) {
      const r = await page.request.post('/api/tools/chalybobs/destinations', {
        data: 'null',
        headers: { 'content-type': 'application/json' },
      });
      expect(r.status(), `try ${i + 1}`).toBe(400);
    }
    expect((await page.request.get('/api/tools/chalybobs/state')).status()).toBe(200);
    for (const path of ['/api/tools/chalybobs/stream-key', '/api/tools/chalybobs/broadcast']) {
      const r = await page.request.post(path, {
        data: 'null',
        headers: { 'content-type': 'application/json' },
      });
      expect(r.status(), path).toBeLessThan(500);
    }
  });

  test('old URL: /app/engines/chalybobs answers 307 to /app/en-vivo with the query', async ({
    page,
  }) => {
    const res = await page.request.get('/app/engines/chalybobs?from=mail', { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers().location).toMatch(/\/app\/en-vivo\?from=mail$/);
  });
});

test.describe('as free', () => {
  asRole('free');
  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
    await dismissCookies(page);
  });
  test.skip(!MOCK, 'E2E_TOOLS_MODE=mock not set');

  test('En vivo viene en Pro: locked inside the app, no stream data', async ({ page }, info) => {
    await page.goto('/app/en-vivo');
    await expect(page.getByRole('heading', { level: 1, name: 'En vivo' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'En vivo viene en Pro' })).toBeVisible();
    await expect(page.getByLabel('Servidor (RTMP URL)')).toHaveCount(0);
    await expect(page.getByRole('tab')).toHaveCount(0);
    const api = await page.request.get('/api/tools/chalybobs/state');
    expect(api.status()).toBe(403);
    await expectNoOverflow(page, info);
  });
});
