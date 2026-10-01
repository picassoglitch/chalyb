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
