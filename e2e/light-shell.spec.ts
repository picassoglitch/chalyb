// Account screens built on the light design render in the light shell, never the dark legacy
// panel (Cerrar mi cuenta shipped as pale text on black because MODERN missed it).

import { test, expect } from '@playwright/test';
import { asRole } from './utils/roles';

const legacyPanel = '.ch-legacy, .cc-shell';

test.describe('as free', () => {
  asRole('free');

  for (const [path, heading] of [
    ['/app/settings/cerrar-cuenta', 'Cerrar mi cuenta'],
    ['/app/settings/arco', /Mis datos/],
    ['/app/terminos', 'Tus opciones'],
  ] as const) {
    test(`${path} is in the light shell`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expect(page.locator(legacyPanel)).toHaveCount(0);
    });
  }
});

test.describe('as pro', () => {
  asRole('pro');

  test('/app/usage/checkout is in the light shell, whatever state it shows', async ({ page }) => {
    await page.goto('/app/usage/checkout?pack=tokens_500k');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator(legacyPanel)).toHaveCount(0);
  });
});
