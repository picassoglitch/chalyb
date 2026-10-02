// Owner panel (P5): the six routes, Dinero's first-screen answer, the
// Personas confirm step (opened and backed out of: nothing changes), axe
// and 360px on each route, and non-admins kept out.

import { test, expect } from '@playwright/test';
import { asRole } from './utils/roles';
import { expectAccessible, expectNoOverflow } from './utils/a11y';

const ROUTES: [string, string][] = [
  ['/dashboard', 'Centro de mando'],
  ['/dashboard/personas', 'Personas'],
  ['/dashboard/dinero', 'Dinero'],
  ['/dashboard/herramientas', 'Herramientas'],
  ['/dashboard/actividad', 'Actividad'],
  ['/dashboard/ajustes', 'Ajustes'],
];

test.describe('as admin', () => {
  asRole('admin');

  test('each nav item opens its screen; axe and 360px are clean', async ({ page }, info) => {
    const mobile = info.project.name === 'mobile-360';
    await page.goto('/dashboard');
    for (const [path, name] of ROUTES) {
      const nav = page.getByRole('navigation', { name: 'Panel del dueño' }).filter({ visible: true }).first();
      await nav.getByRole('link', { name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, '\\/')}$`));
      await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
      await expect(nav.getByRole('link', { name, exact: true })).toHaveAttribute('aria-current', 'page');
      await expectNoOverflow(page, info);
      await expectAccessible(page);
    }
    if (!mobile) {
      await expect(page.getByRole('link', { name: 'Ver la app ›' })).toBeVisible();
      await expect(page.getByText('Dueño', { exact: true })).toBeVisible();
    }
  });

  test('Dinero answers "this month’s revenue + trials paid" on the first screen', async ({ page }, info) => {
    await page.goto('/dashboard/dinero');
    const revenue = page.getByRole('region', { name: 'Ingresos del mes' });
    const trials = page.getByRole('region', { name: 'Pruebas que se convierten' });
    await expect(revenue).toBeInViewport();
    await expect(revenue).toContainText(/\$[\d,]+\.\d{2}|—/);
    await expect(trials).toBeInViewport({ ratio: info.project.name === 'mobile-360' ? 0 : 1 });
    await expect(page.getByText('Viene de Mercado Pago · se actualiza cada hora', { exact: false })).toBeVisible();
    await expect(page.getByText(/Ejemplo/).first()).toBeVisible(); // the configured costs
  });

  test('Centro de mando: real KPIs, attention items link to their place', async ({ page }) => {
    await page.goto('/dashboard');
    for (const label of ['Ingresos del mes', 'Suscriptores activos', 'Pruebas activas', 'Conversión de prueba'])
      await expect(page.getByRole('region', { name: label })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Conversión de prueba' })).toContainText('sin datos suficientes');
    const ideas = page.getByRole('link', { name: 'Leer' });
    await expect(ideas).toHaveAttribute('href', /\/dashboard\/messages$/);
    await page.getByRole('link', { name: 'Hoy', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Ingresos de hoy' })).toBeVisible();
  });

  test('Personas: refund asks "Confirma · paso 2 de 2"; backing out changes nothing', async ({ page }) => {
    await page.goto('/dashboard/personas');
    await page.getByLabel('Buscar por nombre o correo').fill('pro@example.com');
    await page.getByRole('button', { name: 'Acciones para Pablo Ruiz' }).click();
    await page.getByRole('button', { name: 'Reembolsar último cobro' }).click();
    const sheet = page.getByRole('dialog', { name: '¿Reembolsar $868.84 MXN a Pablo Ruiz?' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('Confirma · paso 2 de 2')).toBeVisible();
    await expect(sheet.getByText('Regresa a su tarjeta por Mercado Pago en 5 a 10 días.', { exact: false })).toBeVisible();
    await sheet.locator('.ch-btn', { hasText: 'No, volver' }).click();
    await expect(sheet).toHaveCount(0);
    await page.getByLabel('Buscar por nombre o correo').fill('');
    await page.getByRole('button', { name: 'En prueba' }).click();
    await expect(page.getByRole('cell', { name: /Tere Prueba/ }).first()).toBeVisible();
  });

  test('Actividad filters by type', async ({ page }) => {
    await page.goto('/dashboard/actividad');
    await page.getByRole('link', { name: 'Cancelaciones' }).click();
    await expect(page).toHaveURL(/tipo=cancel/);
    const rows = page.locator('li[data-type]');
    await expect(rows.first()).toBeVisible();
    expect(await rows.evaluateAll((els) => els.every((e) => e.getAttribute('data-type') === 'cancel'))).toBe(true);
  });

  test('main’s screens stay reachable from "Más"; folded ones redirect', async ({ page, request }, info) => {
    test.skip(info.project.name === 'mobile-360', 'desktop sidebar');
    await page.goto('/dashboard');
    await page.getByText('Más', { exact: true }).click();
    await page.getByRole('link', { name: 'Equipo, roles y créditos' }).click();
    await expect(page).toHaveURL(/\/dashboard\/team$/);
    const folded: [string, string][] = [
      ['/dashboard/billing', '/dashboard/dinero'],
      ['/dashboard/activity', '/dashboard/actividad'],
      ['/dashboard/settings', '/dashboard/ajustes'],
    ];
    for (const [from, to] of folded) {
      const r = await request.get(from, { maxRedirects: 0 });
      expect(r.status()).toBe(308);
      expect(r.headers().location).toMatch(new RegExp(`${to}$`));
    }
  });
});

test.describe('as pro', () => {
  asRole('pro');
  test('non-admins are sent to /app, and the live stream refuses them', async ({ page }) => {
    await page.goto('/dashboard/personas');
    await expect(page).toHaveURL(/\/app$/);
    const res = await page.request.get('/api/stream', { maxRedirects: 0 });
    expect(res.status()).toBe(403);
  });
});
