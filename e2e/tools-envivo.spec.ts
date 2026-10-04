// En vivo inside the app (WS-11, TOOLS-SPEC §6, mockups 57–59) against the
// mock adapters (E2E_TOOLS_MODE=mock). The mock "program" types a pairing
// code ~3 s after it's issued; the page polls every 5 s. State lives in the
// server process for the whole run, so each step accepts either side of the
// one-time pairing.

import { test, expect, type Page } from '@playwright/test';
import { asRole } from './utils/roles';
import { dismissCookies } from './utils/cookies';
import { expectNoLeaks } from './utils/no-leaks';
import { expectAccessible, expectNoOverflow } from './utils/a11y';

const MOCK = process.env.E2E_TOOLS_MODE === 'mock';

/** From /app/en-vivo to the live room, pairing the computer if needed. */
async function ensurePaired(page: Page) {
  await page.goto('/app/en-vivo');
  const setup = page.getByRole('heading', { name: 'Conecta tu computadora' });
  if (await setup.isVisible().catch(() => false)) {
    await expect(page.getByText('Este código sirve por 10 minutos.')).toBeVisible();
    await expect(
      page.getByText('Esperando tu computadora… Esta página se actualiza sola.'),
    ).toBeVisible();
    await expect(page.getByText('¡Listo! Tu computadora está conectada.')).toBeVisible({
      timeout: 15_000,
    });
  }
  await expect(page.getByText('OBS conectado').or(page.getByText(/^En vivo · /))).toBeVisible({
    timeout: 15_000,
  });
}

test.describe('as pro', () => {
  asRole('pro');
  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
    await dismissCookies(page);
  });
  test.skip(!MOCK, 'E2E_TOOLS_MODE=mock not set (server must run the tools in mock mode)');

  test('connect → go live → end with the confirm, all in one tab', async ({
    page,
    context,
  }, info) => {
    await page.goto('/app/en-vivo');
    // The tool's own header and tabs, inside the app (ToolShell).
    await expect(page.getByRole('heading', { level: 1, name: 'En vivo' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Transmitir' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const setup = page.getByRole('heading', { name: 'Conecta tu computadora' });
    if (await setup.isVisible().catch(() => false)) {
      // One primary: the download, same tab (an attachment, no new page).
      const dl = page.getByRole('link', { name: /Descargar para (Windows|Mac)/ }).first();
      await expect(dl).toHaveAttribute('href', /\/api\/tools\/chalybobs\/download\?os=/);
      await expect(dl).not.toHaveAttribute('target', '_blank');
      await expect(page.getByLabel(/Tu código: \d{3} \d{3}/)).toBeVisible();
      await expectNoOverflow(page, info);
    }
    await ensurePaired(page);

    const stop = page.getByRole('button', { name: /Terminar transmisión/ });
    if (await stop.isVisible().catch(() => false)) {
      await stop.click();
      await page.getByRole('button', { name: 'Sí, terminar' }).click();
    }
    await page.getByRole('button', { name: /Iniciar transmisión/ }).click();
    await expect(stop).toBeVisible();
    await expect(page.getByRole('timer')).toContainText(/En vivo · \d{2}:\d{2}:\d{2}/);
    // Exactly one primary while live: "Terminar transmisión".
    await expect(
      page.locator('.ch-main .ch-btn--primary:visible, .ch-main .ch-giant:visible'),
    ).toHaveCount(1);

    await page.getByRole('button', { name: /Pantalla/ }).click();
    await expect(page.getByRole('button', { name: /Pantalla/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const mic = page.getByRole('button', { name: /Micrófono/ });
    const before = await mic.getAttribute('aria-pressed');
    await mic.click();
    await expect(mic).not.toHaveAttribute('aria-pressed', before ?? '');

    await page.getByRole('button', { name: /Hacer clip de este momento/ }).click();
    await expect(
      page.getByText('Listo, guardamos este momento. Lo verás en Clips en unos minutos.'),
    ).toBeVisible();

    await expectNoLeaks(page);
    await expectNoOverflow(page, info);
    await expectAccessible(page);

    await stop.click();
    const dialog = page.getByRole('dialog', { name: '¿Terminar tu transmisión?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Seguir transmitiendo' }).click();
    await expect(stop).toBeVisible();
    await stop.click();
    await page.getByRole('button', { name: 'Sí, terminar' }).click();
    await expect(page.getByText(/Tu transmisión terminó · Duró /)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Hacer clips de esta transmisión' })).toBeVisible();

    await page.getByRole('link', { name: 'Ver mis transmisiones' }).click();
    await expect(page).toHaveURL(/\/app\/en-vivo\/transmisiones$/);
    await expect(page.getByRole('link', { name: 'Hacer clips' }).first()).toBeVisible();
    expect(context.pages()).toHaveLength(1);
  });

  test('Ajustes: the stream key is not in the page until "Mostrar"', async ({
    page,
    context,
  }, info) => {
    await ensurePaired(page);
    const key = 'live_youtube_mock_0000_1111_2222';
    await page.goto('/app/en-vivo/ajustes');
    await expect(page.getByRole('tab', { name: 'Ajustes' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByText('Dónde transmites')).toBeVisible();
    await expect(page.getByText('Automática')).toBeVisible();
    await expect(page.getByText('Recomendada')).toBeVisible();
    await expect(
      page.getByText(
        'Tu clave de transmisión está oculta por seguridad. Solo se ve en Opciones avanzadas.',
      ),
    ).toBeVisible();
    expect(await page.content()).not.toContain(key);

    // Connecting shows aceptacion-ux §7 before anything happens.
    const kick = page.locator('.ch-row', { hasText: 'Kick' });
    if (
      await kick
        .getByRole('button', { name: 'Conectar' })
        .isVisible()
        .catch(() => false)
    ) {
      await kick.getByRole('button', { name: 'Conectar' }).click();
      const sheet = page.getByRole('dialog', { name: 'Conectar Kick' });
      await expect(sheet).toContainText('publicar solo cuando tú lo indiques');
      await sheet.getByRole('button', { name: 'Conectar Kick' }).click();
      await expect(kick.getByRole('switch')).toBeVisible();
    }

    await page.getByRole('button', { name: /Opciones avanzadas/ }).click();
    const field = page.getByLabel('Clave de transmisión de YouTube');
    await expect(field).toHaveValue('••••••••');
    expect(await page.content()).not.toContain(key);
    await field.locator('xpath=..').getByRole('button', { name: 'Mostrar' }).click();
    const reauth = page.getByRole('dialog', { name: 'Confirma que eres tú' });
    // Recent sign-in skips the password step; otherwise the dialog opens.
    await reauth.waitFor({ timeout: 5_000 }).catch(() => {});
    if (await reauth.isVisible().catch(() => false)) {
      await reauth.getByLabel('Tu contraseña').fill(process.env.E2E_PRO_PASSWORD ?? '');
      await reauth.getByRole('button', { name: 'Mostrar la clave' }).click();
    }
    await expect(field).toHaveValue(key);
    await expectNoOverflow(page, info);
    expect(context.pages()).toHaveLength(1);
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

  test('En vivo viene en Pro: locked inside the app, no stream controls', async ({
    page,
  }, info) => {
    await page.goto('/app/en-vivo');
    await expect(page.getByRole('heading', { level: 1, name: 'En vivo' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'En vivo viene en Pro' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Iniciar transmisión/ })).toHaveCount(0);
    await expect(page.getByRole('tab')).toHaveCount(0);
    const api = await page.request.get('/api/tools/chalybobs/status');
    expect(api.status()).toBe(403);
    await expectNoOverflow(page, info);
  });
});
