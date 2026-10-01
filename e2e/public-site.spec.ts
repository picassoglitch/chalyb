// Public site (rebuild P4): landing, Planes, redirects, cookie gating, the
// idea form, 360px and axe. Read-only against any target; the idea form posts
// to the mock locally and is skipped against a real deployment.

import { test, expect } from '@playwright/test';
import { expectAccessible, expectNoOverflow } from './utils/a11y';

const PUBLIC = ['/', '/planes', '/en', '/en/planes'];

for (const path of PUBLIC) {
  test(`${path} loads, has no overflow and no serious axe violations`, async ({
    page,
  }, testInfo) => {
    await page.goto(path);
    await expect(page.locator('h1').first()).toBeVisible();
    await expectNoOverflow(page, testInfo);
    await expectAccessible(page);
    await page.screenshot({
      path: testInfo.outputPath(`${path.replace(/\W+/g, '_') || 'root'}.png`),
      fullPage: true,
    });
  });
}

test('the trial button is visible without scrolling at 390×844 and goes to sign-up', async ({
  browser,
}) => {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await page.goto('/');
  const cta = page.locator('[data-cta="trial-hero"]');
  await expect(cta).toBeInViewport();
  // TRIAL_FLOW_ENABLED is off by default, so it opens the existing sign-up;
  // the flag-on target is covered by tests/public-site.test.ts.
  const href = await cta.getAttribute('href');
  expect(href).toMatch(/^\/sign-in\?mode=signup&(plan=pro|intent=trial)$/);
  await page.close();
});

test('prices sit in a block that says IVA incluido', async ({ page }) => {
  await page.goto('/');
  const plans = page.locator('#planes');
  await expect(plans.locator('[data-price="pro_year"]')).toContainText('MXN al año');
  await expect(plans).toContainText('Precios en MXN, IVA incluido.');
  await expect(plans).not.toContainText('2 meses gratis');
  await expect(plans.locator('s, del')).toHaveCount(0);
});

test('only the active tools are listed', async ({ page }) => {
  await page.goto('/');
  const names = await page.locator('#herramientas .pub-tc h3').allInnerTexts();
  // The catalog decides how many; the order and the hidden ones are fixed.
  const order = [
    'Clips',
    'Señales',
    'En vivo',
    'Asistente',
    'Pronósticos',
    'Inmuebles',
    'Inversiones',
  ];
  const tools = names.slice(0, -1);
  expect(names.at(-1)).toBe('Tu idea');
  expect(tools.length).toBeGreaterThan(0);
  expect(tools).toEqual(order.filter((n) => tools.includes(n)));
  expect(names).not.toContain('Stream Manager');
});

for (const [from, to] of [
  ['/precios', '/planes'],
  ['/pricing', '/planes'],
  ['/en/precios', '/en/planes'],
  ['/engines', '/'],
  ['/en/engines', '/en/'],
] as const) {
  test(`${from} → ${to} (308)`, async ({ request }) => {
    const res = await request.get(from, { maxRedirects: 0 });
    expect(res.status()).toBe(308);
    expect(new URL(res.headers()['location']!, 'http://x').pathname).toBe(to);
  });
}

test('/planes is 200 with a www canonical', async ({ page }) => {
  const res = await page.goto('/planes');
  expect(res?.status()).toBe(200);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://www.chalyb.com/planes',
  );
});

test('no analytics request before consent; one after "Aceptar todas"', async ({ page }) => {
  const analytics: string[] = [];
  page.on('request', (r) => {
    if (/\/_vercel\/insights|va\.vercel-scripts\.com/.test(r.url())) analytics.push(r.url());
  });
  await page.goto('/');
  const banner = page.getByRole('dialog');
  await expect(banner).toContainText('Usamos cookies necesarias');
  await page.waitForLoadState('networkidle');
  expect(analytics).toEqual([]);

  await banner.getByRole('button', { name: 'Aceptar todas' }).click();
  await expect(banner).toBeHidden();
  await expect.poll(() => analytics.length).toBeGreaterThan(0);
});

test('"Solo necesarias" keeps analytics off, and the footer link reopens the banner', async ({
  page,
}) => {
  const analytics: string[] = [];
  page.on('request', (r) => {
    if (/\/_vercel\/insights|va\.vercel-scripts\.com/.test(r.url())) analytics.push(r.url());
  });
  await page.goto('/');
  await page.getByRole('dialog').getByRole('button', { name: 'Solo necesarias' }).click();
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(analytics).toEqual([]);

  await page.locator('footer').getByRole('button', { name: 'Cookies' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('the idea form submits', async ({ page }) => {
  test.skip(
    !/localhost|127\.0\.0\.1/.test(process.env.E2E_BASE_URL ?? 'localhost'),
    'writes a lead; runs only against the local mock',
  );
  await page.goto('/#idea');
  const form = page.locator('#idea form');
  await form.getByLabel('Tu nombre').fill('Prueba E2E');
  await form.getByLabel('Tu correo').fill('e2e@example.com');
  await form
    .getByLabel('¿Qué herramienta te gustaría?')
    .fill('Una herramienta para agendar citas con clientes');
  await form.getByRole('button', { name: 'Proponer mi idea' }).click();
  await expect(page.locator('#idea [role="status"]')).toContainText('Recibimos tu idea');
});
