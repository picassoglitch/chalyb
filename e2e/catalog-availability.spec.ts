// Run after the normal suite, against its local mock only. These fixtures
// must never hide real engines or mutate a preview/production catalog.
import { test, expect, type APIRequestContext } from '@playwright/test';
import { expectNoOverflow } from './utils/a11y';
import { asRole } from './utils/roles';

const mockOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const appOrigin = process.env.E2E_BASE_URL ?? '';
const local = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
  } catch {
    return false;
  }
};
const isMock = process.env.E2E_MOCK_BACKEND === '1' && local(mockOrigin) && local(appOrigin);
const slugs = ['chalybclip', 'chalybobs'] as const;
let saved: { slug: string; status: string }[] = [];

test.describe.configure({ mode: 'serial' });
test.skip(!isMock, 'catalog fixtures run only against the local mock backend');

test.beforeAll(async ({ request }) => {
  const response = await request.get(`${mockOrigin}/rest/v1/engines?select=slug,status`);
  expect(response.ok()).toBe(true);
  saved = (await response.json()).filter((row: { slug: string }) =>
    slugs.some((slug) => slug === row.slug),
  );
  expect(saved).toHaveLength(slugs.length);
  // A run killed mid-way would leave fixtures behind; the restored state must be the seed.
  expect(saved.every((row) => row.status === 'active')).toBe(true);
});

test.afterAll(async ({ request }) => {
  // Restore every row before failing, so one bad PATCH can't leave the other mutated.
  const failed: string[] = [];
  for (const row of saved) {
    const response = await request.patch(`${mockOrigin}/rest/v1/engines?slug=eq.${row.slug}`, {
      data: { status: row.status },
    });
    if (!response.ok()) failed.push(row.slug);
  }
  expect(failed).toEqual([]);
});

async function catalog(request: APIRequestContext, active: readonly string[]) {
  if (!isMock) throw new Error('refusing to modify a real catalog');
  for (const slug of slugs) {
    const response = await request.patch(`${mockOrigin}/rest/v1/engines?slug=eq.${slug}`, {
      data: { status: active.includes(slug) ? 'active' : 'coming_soon' },
    });
    expect(response.ok()).toBe(true);
  }
}

test('an empty catalog shows account access and support without selling a tool', async ({
  page,
  request,
}, info) => {
  await catalog(request, []);
  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/en', '/planes', '/en/planes']) {
      await page.goto(path);
      await expect(page.getByTestId('catalog-unavailable')).toBeVisible();
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('a[href="/sign-in"], a[href="/en/sign-in"]')).toBeVisible();
      await expect(page.locator('a[href="/contacto"], a[href="/en/contacto"]')).toBeVisible();
      await expect(page.locator('[data-cta], #precios, #como, .pub-gall2, .pub-notif')).toHaveCount(
        0,
      );
      await expect(page.locator('a[href*="intent=trial"]')).toHaveCount(0);
      expect(await page.title()).not.toMatch(/clips|live stream|transmisiones/i);
      await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
      await expectNoOverflow(page, info);
    }
  }
  // Pages that keep the public chrome stop pointing at tools, prices and the trial.
  for (const path of ['/contacto', '/en/contacto']) {
    await page.goto(path);
    await expect(page.locator('[data-cta], a[href*="intent=trial"]')).toHaveCount(0);
    await expect(
      page.locator('[data-nav="tools"], [data-nav="pricing"], [data-foot="tools"]'),
    ).toHaveCount(0);
    await expect(page.locator('a[href$="#precios"], a[href$="/planes"]')).toHaveCount(0);
  }
});

test('an En vivo-only catalog does not promise Clips or show clip demonstrations', async ({
  page,
  request,
}, info) => {
  await catalog(request, ['chalybobs']);
  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/en', '/planes', '/en/planes']) {
      await page.goto(path);
      await expect(page.getByTestId('catalog-unavailable')).toHaveCount(0);
      if (path === '/' || path === '/en') {
        await expect(page.locator('#herramientas .pub-bc h3')).toHaveText(['En vivo']);
      }
      await expect(page.getByTestId('plan-cards')).toBeVisible();
      await expect(page.locator('#como, .pub-gall2, .pub-dev, .pub-notif')).toHaveCount(0);
      expect(await page.locator('main').innerText()).not.toMatch(/clips/i);
      expect(await page.locator('footer').innerText()).not.toMatch(/clips/i);
      expect(await page.title()).not.toMatch(/clips/i);
      await expectNoOverflow(page, info);
    }
  }
});

test('a Clips-only catalog keeps clip demonstrations without advertising En vivo', async ({
  page,
  request,
}, info) => {
  await catalog(request, ['chalybclip']);
  const live = /en vivo|live stream/i;
  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/en', '/planes', '/en/planes']) {
      await page.goto(path);
      await expect(page.getByTestId('catalog-unavailable')).toHaveCount(0);
      if (path === '/' || path === '/en') {
        await expect(page.locator('#herramientas .pub-bc h3')).toHaveText(['Clips']);
        await expect(page.locator('#como')).toBeVisible();
        await expect(page.locator('.pub-gall2')).toBeVisible();
        await expect(page.locator('.pub-dev')).toBeVisible();
        expect(await page.locator('#hero').innerText()).not.toMatch(live);
      }
      await expect(page.getByTestId('plan-cards')).toBeVisible();
      expect(await page.locator('footer').innerText()).not.toMatch(live);
      expect(await page.title()).not.toMatch(live);
      await expectNoOverflow(page, info);
    }
  }
});

test('both tools active restores the full landing', async ({ page, request }) => {
  await catalog(request, slugs);
  for (const path of ['/', '/en']) {
    await page.goto(path);
    await expect(page.locator('#herramientas .pub-bc h3')).toHaveText(['Clips', 'En vivo']);
    await expect(page.locator('#como, .pub-gall2, .pub-dev')).toHaveCount(3);
    await expect(page.locator('[data-cta="nav_trial"]')).toBeVisible();
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
  }
});

test.describe('account plan availability', () => {
  asRole('free');
  test('account plan cards respect empty and En vivo-only catalogs', async ({ page, request }) => {
    await catalog(request, []);
    await page.goto('/app/planes');
    await expect(page.getByTestId('catalog-unavailable')).toBeVisible();
    await expect(page.getByTestId('plan-cards')).toHaveCount(0);
    // Payers sent here by the billing banner still reach their account.
    await expect(
      page.getByTestId('catalog-unavailable').locator('a[href$="/app/billing"]'),
    ).toBeVisible();
    await catalog(request, ['chalybobs']);
    await page.reload();
    await expect(page.getByTestId('catalog-unavailable')).toHaveCount(0);
    await expect(page.getByTestId('plan-cards')).toBeVisible();
    expect(await page.getByTestId('plan-cards').innerText()).not.toMatch(/clips/i);
  });
});
