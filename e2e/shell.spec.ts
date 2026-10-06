// P1 shell (SCR-01/07/08): three nav items on desktop and as bottom tabs on
// mobile, old /app routes still answer, Inicio and Mi cuenta render real data.

import { test, expect } from '@playwright/test';
import { asRole, type Role } from './utils/roles';
import { expectNoLeaks } from './utils/no-leaks';
import { expectAccessible, expectNoOverflow } from './utils/a11y';

const OLD_ROUTES = [
  '/app/engines',
  '/app/subscription',
  '/app/usage',
  '/app/billing',
  '/app/messages',
  '/app/help',
  '/app/history',
  '/app/settings/perfil',
];

/** Demo values from the mockups that must never reach production. */
const SAMPLE_DATA = ['1,200', '4821', 'Noche de preguntas', 'hace 10 minutos', '@MariaEnVivo'];

for (const role of ['free', 'pro', 'vip', 'admin'] as Role[]) {
  test.describe(`as ${role}`, () => {
    asRole(role);

    test('nav reaches Inicio, Mis resultados and Mi cuenta', async ({ page }, info) => {
      const mobile = info.project.name === 'mobile-360';
      await page.goto('/app');
      const nav = page.locator('nav[aria-label="Navegación principal"]:visible');
      await expect(nav.getByRole('link')).toHaveCount(role === 'admin' && !mobile ? 4 : 3);
      for (const [name, url] of [
        [mobile ? 'Resultados' : 'Mis resultados', /\/app\/history$/],
        [mobile ? 'Cuenta' : 'Mi cuenta', /\/app\/settings$/],
        ['Inicio', /\/app$/],
      ] as const) {
        await nav.getByRole('link', { name, exact: true }).click();
        await expect(page).toHaveURL(url);
        await expect(nav.getByRole('link', { name, exact: true })).toHaveAttribute(
          'aria-current',
          'page',
        );
      }
    });

    test('Inicio: real cards, plan strip, no sample data', async ({ page }, info) => {
      await page.goto('/app');
      await expect(
        page.getByRole('heading', { level: 1, name: '¿Qué quieres hacer hoy?' }),
      ).toBeVisible();
      for (const sample of SAMPLE_DATA) await expect(page.getByText(sample)).toHaveCount(0);
      await expectNoLeaks(page);
      await expectNoOverflow(page, info);
      await expectAccessible(page);
      await page.getByRole('link', { name: /Hacer clips de mi stream/ }).click();
      await expect(page).toHaveURL(/\/app\/(clips|engines\/chalybclip)$/);
    });

    test('Mi cuenta: structure, no jargon, "Ver mi plan" goes somewhere real', async ({
      page,
    }, info) => {
      await page.goto('/app/settings');
      await expect(page.getByRole('heading', { level: 1, name: 'Mi cuenta' })).toBeVisible();
      await expect(page.getByText('CFDI listo')).toHaveCount(0);
      for (const sample of SAMPLE_DATA) await expect(page.getByText(sample)).toHaveCount(0);
      await expectNoLeaks(page);
      await expectNoOverflow(page, info);
      await expectAccessible(page);
      await page.getByRole('link', { name: 'Ver mi plan' }).click();
      // Paid → Mi plan; Free → the trial once it exists, else the plans page.
      await expect(page).toHaveURL(/\/app\/(billing|subscription|prueba)$/);
    });

    test('old /app routes still answer', async ({ request }) => {
      for (const path of OLD_ROUTES) expect((await request.get(path)).status(), path).toBe(200);
    });
  });
}

test.describe('as admin', () => {
  asRole('admin');
  test('the user card names the effective plan; "Vista admin" goes to /dashboard', async ({
    page,
  }, info) => {
    test.skip(info.project.name === 'mobile-360', 'desktop sidebar');
    await page.goto('/app');
    await expect(page.locator('.ch-me')).toContainText('Plan VIP');
    await expect(page.getByRole('link', { name: 'Vista admin' })).toHaveAttribute(
      'href',
      /\/dashboard$/,
    );
  });
});

test('/app/cuenta redirects to Mi cuenta', async ({ request }) => {
  const res = await request.get('/app/cuenta', { maxRedirects: 0 });
  expect(res.status()).toBe(308);
  expect(res.headers()['location']).toBe('/app/settings');
});
