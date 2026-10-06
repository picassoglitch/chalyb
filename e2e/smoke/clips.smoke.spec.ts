// @smoke · after each deploy (OPS-9): a known public link produces ≥ 3 clips
// in under 10 minutes (BUILD-SPEC §4.1 B3). Needs E2E_SMOKE_VIDEO_URL and an
// account with Clips. Runs the hub flow; with TOOL_HUB_MODE_CHALYBCLIP=off the
// clips are made in the Clips app and this measurement belongs there.

import { test, expect } from '@playwright/test';
import { asRole } from '../utils/roles';

test.describe('@smoke clips', () => {
  asRole('pro');
  test.skip(!process.env.E2E_SMOKE_VIDEO_URL, 'E2E_SMOKE_VIDEO_URL not set');
  test.skip(
    process.env.E2E_CLIPS_MODE !== 'on' && process.env.E2E_CLIPS_MODE !== 'mock',
    'hub Clips mode is off',
  );

  test('a public link makes at least 3 clips in under 10 minutes', async ({ page }) => {
    test.setTimeout(11 * 60_000);
    await page.goto('/app/clips');
    await page.getByLabel(/Pega el enlace/).fill(process.env.E2E_SMOKE_VIDEO_URL!);
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Crear mis clips' }).click();
    await expect(page.getByRole('heading', { name: /Tus clips están listos/ })).toBeVisible({
      timeout: 10 * 60_000,
    });
    expect(await page.getByRole('link', { name: /^Descargar / }).count()).toBeGreaterThanOrEqual(3);
  });
});
