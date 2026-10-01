// EN sign-out reads English (P0-10).

import { test, expect } from '@playwright/test';
import { asRole } from './utils/roles';

test.describe('as free', () => {
  asRole('free');
  // Sign-out lives in Mi cuenta since P1 (BUILD-SPEC §5.3).
  test('/en/app/settings has a "Sign out" button', async ({ page }) => {
    await page.goto('/en/app/settings');
    await expect(page.getByRole('button', { name: 'Sign out' }).first()).toBeVisible();
  });
});
