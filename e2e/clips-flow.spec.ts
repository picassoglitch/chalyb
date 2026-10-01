// Clips end to end in the hub (P0-16, BUILD-SPEC §4.3) against the mock
// adapter: the server under test runs with TOOL_HUB_MODE_CHALYBCLIP=mock and
// this spec with E2E_CLIPS_MODE=mock.

import { test, expect, type Page } from '@playwright/test';
import { asRole, type Role } from './utils/roles';
import { expectAccessible, expectNoOverflow } from './utils/a11y';

const MOCK = process.env.E2E_CLIPS_MODE === 'mock';

async function makeClips(page: Page, link: string) {
  let taps = 0;
  await page.goto('/app');
  await page.getByRole('link', { name: /Clips/ }).first().click();
  taps++;
  await page.getByLabel(/Pega el enlace/).fill(link);
  await page.getByRole('button', { name: 'Continuar' }).click();
  taps++;
  await page.getByRole('button', { name: 'Crear mis clips' }).click();
  taps++;
  return () => taps;
}

for (const role of ['free', 'trial', 'pro', 'pro_annual', 'past_due', 'vip', 'admin'] as Role[]) {
  test.describe(`as ${role}`, () => {
    asRole(role);
    test.skip(!MOCK, 'E2E_CLIPS_MODE=mock not set (server must run TOOL_HUB_MODE_CHALYBCLIP=mock)');

    test('paste a link → clips ready to download, in ≤ 5 taps', async ({ page }, testInfo) => {
      const taps = await makeClips(page, 'https://www.youtube.com/watch?v=e2e');
      await expect(page.getByRole('heading', { name: /Tus clips están listos/ })).toBeVisible({
        timeout: 30_000,
      });
      const download = page.waitForEvent('download');
      await page.getByRole('link', { name: /Descargar Clip 1/ }).click();
      await download;
      expect(taps() + 1).toBeLessThanOrEqual(5);
      await expectNoOverflow(page, testInfo);
      await expectAccessible(page);
    });

    test('a private link fails clearly and charges nothing', async ({ page }) => {
      await makeClips(page, 'https://www.youtube.com/watch?v=private');
      await expect(page.getByRole('heading', { name: 'No pudimos leer ese enlace' })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByText('No se usaron créditos.')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Hablar con una persona' })).toBeVisible();
    });
  });
}

test.describe('as pro', () => {
  asRole('pro');
  test.skip(!MOCK, 'E2E_CLIPS_MODE=mock not set');

  test('keyboard only: paste → format → creating (P3-1)', async ({ page }) => {
    await page.goto('/app/clips');
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      if (await page.evaluate(() => document.activeElement?.id === 'clip-link')) break;
    }
    await page.keyboard.type('https://www.youtube.com/watch?v=teclado');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/app\/clips\/formato\?link=/);
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
      const name = await page.evaluate(() => document.activeElement?.textContent?.trim());
      if (name === 'Crear mis clips') break;
    }
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: /Estamos creando tus clips|Tus clips están listos/ })).toBeVisible();
  });

  test('refresh on step 2 keeps the link', async ({ page }) => {
    await page.goto('/app/clips?link=' + encodeURIComponent('https://www.youtube.com/watch?v=refresh'));
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.reload();
    await expect(page.locator('input[name="link"]')).toHaveValue('https://www.youtube.com/watch?v=refresh');
  });

  test('advanced options in ≤ 2 taps; several videos at once', async ({ page }) => {
    await page.goto('/app/clips/formato?link=' + encodeURIComponent('https://www.youtube.com/watch?v=varios'));
    await page.getByText('Opciones avanzadas').click(); // tap 1
    const more = page.getByLabel('Subir varios videos a la vez');
    await more.click(); // tap 2
    await more.fill('https://www.twitch.tv/videos/1\nhttps://kick.com/video/2');
    await page.getByRole('button', { name: 'Crear mis clips' }).click();
    await expect(page).toHaveURL(/\/app\/history$/);
    await expect(page.locator('.ch-result')).not.toHaveCount(0);
  });

  test('the ✕ asks before dropping what was typed', async ({ page }) => {
    await page.goto('/app/clips');
    await page.getByLabel(/Pega el enlace/).fill('https://www.youtube.com/watch?v=x');
    await page.getByRole('link', { name: 'Cerrar y volver a Inicio' }).click();
    await expect(page.getByRole('dialog', { name: '¿Salir? Lo que escribiste no se guardará.' })).toBeVisible();
    await page.getByRole('button', { name: 'Sí, salir' }).click();
    await expect(page).toHaveURL(/\/app$/);
  });

  test('ready clips can be shared', async ({ page }) => {
    await makeClips(page, 'https://www.youtube.com/watch?v=compartir');
    await expect(page.getByRole('heading', { name: /Tus clips están listos/ })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Compartir Clip 1' })).toBeVisible();
  });
});

