// Canonical and hreflang on www (P0-12).

import { test, expect } from '@playwright/test';

for (const [path, canonical] of [
  // Next prints the root canonical without its trailing slash; same URL.
  ['/', /^https:\/\/www\.chalyb\.com\/?$/],
  ['/contacto', 'https://www.chalyb.com/contacto'],
  ['/legal/terms', 'https://www.chalyb.com/legal/terms'],
  ['/en/contacto', 'https://www.chalyb.com/en/contacto'],
] as [string, string | RegExp][]) {
  test(`${path} has a www canonical and hreflang`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
    await expect(page.locator('link[rel="alternate"][hreflang="es-MX"]')).toHaveCount(1);
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(1);
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1);
  });
}

test('robots and sitemap point at www', async ({ request }) => {
  expect(await (await request.get('/robots.txt')).text()).toContain(
    'Sitemap: https://www.chalyb.com/sitemap.xml',
  );
  const sitemap = await (await request.get('/sitemap.xml')).text();
  for (const loc of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g))
    expect(loc[1]).toMatch(/^https:\/\/www\.chalyb\.com/);
});

test('private routes are noindex', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});
