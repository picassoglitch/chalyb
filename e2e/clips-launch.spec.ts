// "Abrir" on Clips (P0-1, P0-14): a new tab on the engine's SSO URL, or — with
// popups blocked — a visible link to it. Needs a preview whose Clips engine is
// wired (OPS-5) and E2E_ALLOW_MUTATIONS=1, because the first click may create
// the user's account at the engine.

import { test, expect } from '@playwright/test';
import { asRole, mutationsAllowed } from './utils/roles';

test.describe('as pro', () => {
  asRole('pro');
  test.skip(!mutationsAllowed(), 'E2E_ALLOW_MUTATIONS=1 required (may provision at the engine)');

  test('popups allowed: Abrir opens the SSO URL in a new tab', async ({ page, context }) => {
    await page.goto('/app/engines/chalybclip');
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('button', { name: 'Abrir' }).click(),
    ]);
    await popup.waitForURL(/\/auth\/sso\?token=/, { timeout: 20_000 });
    expect(popup.url()).toContain('/auth/sso?token=');
  });

  test('popups blocked: Abrir shows a link to the SSO URL', async ({ page }) => {
    await page.addInitScript(() => {
      window.open = () => null;
    });
    await page.goto('/app/engines/chalybclip');
    await page.getByRole('button', { name: 'Abrir' }).click();
    const link = page.getByRole('status').getByRole('link', { name: /Abrir Clips/ });
    await expect(link).toHaveAttribute('href', /\/auth\/sso\?token=/);
  });

  test('no console errors on the way', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto('/app/engines/chalybclip');
    expect(errors).toEqual([]);
  });
});
