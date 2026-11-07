// Owner request 2026-11-07 — English readers can switch language from any
// header, and the app remembers the choice for the next sign-in (/account).

import { expect, test } from '@playwright/test';
import { asRole } from './utils/roles';

test.describe('public header language toggle', () => {
  test('landing → English → back, same page, at every width', async ({ page }) => {
    await page.goto('/planes');
    const toEn = page.locator('header [data-lang-toggle="en"]');
    await expect(toEn).toBeVisible();
    await toEn.click();
    await expect(page).toHaveURL(/\/en\/planes$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    const toEs = page.locator('header [data-lang-toggle="es"]');
    await expect(toEs).toBeVisible();
    await toEs.click();
    await expect(page).toHaveURL(/\/planes$/);
    await expect(page).not.toHaveURL(/\/en\//);
  });

  test('English footer names the tools in English', async ({ page }) => {
    await page.goto('/en');
    const tools = page.locator('footer nav[data-foot="tools"]');
    await expect(tools).not.toContainText('En vivo');
  });
});

test.describe('in-app language toggle', () => {
  test.describe.configure({ mode: 'serial' });
  asRole('trial');

  test('switches the page and is remembered by /account', async ({ page }) => {
    await page.goto('/app/settings');
    const toggle = page.locator('[data-lang-toggle="en"]:visible').first();
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page).toHaveURL(/\/en\/app\/settings$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    // The default (unprefixed) landing after sign-in follows the saved choice.
    await page.goto('/account');
    await expect(page).toHaveURL(/\/en\/app$/);

    // And back to Spanish, which /account then follows too.
    await page.goto('/en/app/settings');
    await page.locator('[data-lang-toggle="es"]:visible').first().click();
    await expect(page).toHaveURL(/\/app\/settings$/);
    await expect(page).not.toHaveURL(/\/en\//);
    await page.goto('/account');
    await expect(page).toHaveURL(/\/app$/);
    await expect(page).not.toHaveURL(/\/en\//);
  });
});
