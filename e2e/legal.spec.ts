// WS-12 · legal pages (old P6-1): every footer document answers 200, the
// versioned URLs consent events cite resolve, unknown versions 404, and
// Law's drafts say so and stay out of search while LEGAL_PUBLISH is off.

import { test, expect } from '@playwright/test';
import { expectAccessible, expectNoOverflow } from './utils/a11y';

const PAGES = ['/legal/terms', '/legal/subscription', '/legal/privacy', '/legal/acceptable-use'];
const drafts = !process.env.E2E_TRIAL_FLOW;

for (const path of PAGES) {
  test(`${path} and its versioned URL answer 200`, async ({ request }) => {
    expect((await request.get(path)).status()).toBe(200);
    expect((await request.get(`/en${path}`)).status()).toBe(200);
    expect((await request.get(`${path}/v1-0`)).status()).toBe(200);
    expect((await request.get(`${path}/v9-9`)).status()).toBe(404);
  });
}

test('the subscription terms render Law’s text with config amounts', async ({ page }, testInfo) => {
  await page.goto('/legal/subscription');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Términos de Suscripción');
  await expect(page.getByRole('heading', { name: /Planes y precios/ })).toBeVisible();
  await expect(page.locator('table').first()).toContainText('$997 MXN');
  await expect(page.getByText(/SHA-256 [0-9a-f]{64}/)).toBeVisible();
  await expectNoOverflow(page, testInfo);
  await expectAccessible(page);
});

test('drafts are marked and noindex while LEGAL_PUBLISH is off', async ({ page }) => {
  test.skip(!drafts, 'flow on: e2e treats the drafts as published');
  await page.goto('/legal/acceptable-use');
  await expect(page.getByRole('note')).toContainText('Borrador en revisión');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('English pages say the Spanish version prevails', async ({ page }) => {
  await page.goto('/en/legal/subscription');
  await expect(page.getByText('The Spanish version prevails.')).toBeVisible();
});
