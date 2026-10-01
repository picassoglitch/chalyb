// Signs each configured role in once and saves its session for the specs.

import { test as setup, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { ROLES, credentials, storageStatePath } from './utils/roles';

mkdirSync('e2e/.auth', { recursive: true });

for (const role of ROLES) {
  setup(`sign in as ${role}`, async ({ page }) => {
    const creds = credentials(role);
    setup.skip(!creds, `no credentials for ${role}`);
    await page.goto('/sign-in');
    await page.locator('#auth-email').fill(creds!.email);
    await page.locator('#auth-password').fill(creds!.password);
    await page.locator('button.auth-submit').click();
    await page.waitForURL(/\/(app|dashboard)(\/|$|\?)/);
    await expect(page.locator('body')).toBeVisible();
    await page.context().storageState({ path: storageStatePath(role) });
  });
}
