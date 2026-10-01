// EN sign-out reads English (P0-10).

import { test, expect } from '@playwright/test';
import { asRole } from './utils/roles';

test.describe('as free', () => {
  asRole('free');
  test('/en/app has a "Sign out" button', async ({ page }) => {
    await page.goto('/en/app');
    await expect(page.getByRole('button', { name: 'Sign out' }).first()).toBeVisible();
  });
});
