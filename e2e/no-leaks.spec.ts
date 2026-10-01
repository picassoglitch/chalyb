// No customer page shows config, env names, log hints, old names or dead
// states (P0-4…P0-8), and every page passes axe and 360px (§6.2, §6.3).

import { test, expect } from '@playwright/test';
import { asRole, type Role } from './utils/roles';
import { expectNoLeaks } from './utils/no-leaks';
import { expectAccessible, expectNoOverflow } from './utils/a11y';

const PAGES = ['/app', '/app/engines', '/app/billing', '/app/usage', '/app/settings', '/app/clips'];

for (const role of ['free', 'trial', 'pro', 'pro_annual', 'past_due', 'vip', 'admin'] as Role[]) {
  test.describe(`as ${role}`, () => {
    asRole(role);

    for (const path of PAGES) {
      test(`${path} is clean`, async ({ page }, testInfo) => {
        await page.goto(path);
        await expectNoLeaks(page);
        await expectNoOverflow(page, testInfo);
        await expectAccessible(page);
      });
    }

    test('every tool page is clean', async ({ page }, testInfo) => {
      await page.goto('/app/engines');
      const hrefs = await page
        .locator('a[href*="/app/engines/"]')
        .evaluateAll((as) => [...new Set(as.map((a) => (a as HTMLAnchorElement).pathname))]);
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) {
        await page.goto(href);
        await expectNoLeaks(page);
        await expectNoOverflow(page, testInfo);
        await expectAccessible(page);
        const diagnostics = page.getByTestId('admin-diagnostics');
        if (role === 'admin') {
          await expect(diagnostics).toHaveCount(1);
          await expect(diagnostics).not.toHaveAttribute('open', /.*/);
        } else {
          await expect(diagnostics).toHaveCount(0);
        }
      }
    });
  });
}

test.describe('as admin', () => {
  asRole('admin');
  test('/app/billing does not show the admin as Free (B11)', async ({ page }) => {
    await page.goto('/app/billing');
    // Mi plan (P2) shows an admin's effective plan: VIP, without a charge.
    await expect(page.getByRole('heading', { level: 2, name: /VIP/ })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: /^(Gratis|Free)$/ })).toHaveCount(0);
  });
});

test.describe('as free', () => {
  asRole('free');
  test('a Pro tool shows the Pro offer, not a lock (B1)', async ({ page }) => {
    await page.goto('/app/engines/chalybcrypto');
    await expect(page.getByText('Incluido en Pro · Pruébalo gratis').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Abrir', exact: true })).toHaveCount(0);
  });
});
