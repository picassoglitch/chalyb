// Mi cuenta → Cerrar mi cuenta, filing the request (mock backend only). It changes the
// shared free account for every later visit, so it runs once, after the other specs.

import { test, expect } from '@playwright/test';
import { asRole } from './utils/roles';

const MOCK = process.env.E2E_MOCK_BACKEND === '1';

test.describe('as free', () => {
  asRole('free');
  // A retry would find the request already filed and fail on the checkbox, hiding the first error.
  test.describe.configure({ retries: 0 });

  test('confirming files the request; the screen then shows it open', async ({ page }) => {
    test.skip(!MOCK, 'E2E_MOCK_BACKEND=1 not set (files a closure request)');
    await page.goto('/app/settings/cerrar-cuenta');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Cerrar mi cuenta' }).click();
    await expect(page.getByRole('status')).toContainText('Recibimos tu solicitud');
    await page.reload();
    await expect(page.getByRole('status')).toContainText('Ya pediste cerrar tu cuenta');
    await expect(page.getByRole('button', { name: 'Cerrar mi cuenta' })).toHaveCount(0);
    await expect(page.locator('.ch-legacy')).toHaveCount(0); // was pale text in the dark legacy panel
  });
});
