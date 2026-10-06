// Owner-panel actions that change shared state (P5). Runs in its own project
// after every other spec, and only against the local mock backend
// (E2E_MOCK_BACKEND=1): never against a real preview.

import { test, expect } from '@playwright/test';
import { asRole, storageStatePath } from './utils/roles';

const MOCK = process.env.E2E_MOCK_BACKEND === '1';

test.describe('as admin', () => {
  asRole('admin');
  test.describe.configure({ mode: 'serial' });
  test.skip(!MOCK, 'E2E_MOCK_BACKEND=1 not set (mutates shared state)');

  test('gift a month → confirm → the Actividad row names the admin', async ({ page }) => {
    await page.goto('/dashboard/personas');
    await page.getByLabel('Buscar por nombre o correo').fill('gina');
    await page.getByRole('button', { name: 'Acciones para Gina Regalo' }).click();
    await page.getByRole('button', { name: 'Regalar 1 mes gratis' }).click();
    await page
      .getByRole('dialog', { name: '¿Regalar 1 mes de Pro a Gina Regalo?' })
      .getByRole('button', { name: 'Sí, regalar' })
      .click();
    await expect(page.getByText('Listo. Ya está en Actividad.')).toBeVisible();
    await page.goto('/dashboard/actividad?tipo=admin');
    const row = page.locator('li[data-type="admin"]', { hasText: 'Regaló 1 mes gratis' }).first();
    await expect(row).toContainText('gina@example.com');
    await expect(row).toContainText('admin@example.com');
  });

  test('hide a used tool: the confirm explains §7.3, then it disappears everywhere', async ({
    page,
    browser,
  }) => {
    await page.goto('/dashboard/herramientas');
    await page.getByRole('switch', { name: 'Mostrar Inmuebles a clientes' }).click();
    const sheet = page.getByRole('dialog', { name: '¿Ocultar Inmuebles?' });
    await expect(sheet).toContainText('§7.3');
    await sheet.getByRole('button', { name: 'Sí, ocultar' }).click();
    await expect(
      page.getByRole('switch', { name: 'Mostrar Inmuebles a clientes' }),
    ).toHaveAttribute('aria-checked', 'false');

    const pro = await browser.newContext({ storageState: storageStatePath('pro') });
    const p = await pro.newPage();
    await p.goto('/app/herramientas');
    await expect(p.getByRole('heading', { name: 'Tus herramientas' })).toBeVisible();
    await expect(p.getByRole('heading', { name: 'Inmuebles', exact: true })).toHaveCount(0);
    await p.goto('/app/herramientas/inmuebles');
    await expect(p).toHaveURL(/\/app\/herramientas$/);
    await p.goto('/');
    await expect(p.getByText('Inmuebles', { exact: true })).toHaveCount(0);
    await pro.close();

    await page.getByRole('switch', { name: 'Mostrar Inmuebles a clientes' }).click();
    await expect(
      page.getByRole('switch', { name: 'Mostrar Inmuebles a clientes' }),
    ).toHaveAttribute('aria-checked', 'true');
  });

  test('Mensual off hides it from Planes and the trial; on brings it back', async ({
    page,
    browser,
  }) => {
    // The Mensual/Anual toggle only exists with the trial flow (annual plans
    // are sold through it); with the flow off Planes is monthly-only (K-6).
    test.skip(process.env.E2E_TRIAL_FLOW !== '1', 'needs E2E_TRIAL_FLOW=1');
    await page.goto('/dashboard/ajustes');
    const sw = page.getByRole('switch', { name: 'Ofrecer Mensual además de Anual' });
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await sw.click();
    await expect(page.getByText('Guardado.')).toBeVisible();

    const free = await browser.newContext({ storageState: storageStatePath('free') });
    const f = await free.newPage();
    await f.goto('/planes');
    await expect(f.getByRole('radio', { name: /Mensual/ })).toHaveCount(0);
    await f.goto('/app/prueba');
    await expect(f.getByText(/mensual/i)).toHaveCount(0);

    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await f.goto('/planes');
    await expect(f.getByRole('radio', { name: /Mensual/ })).toBeVisible();
    await free.close();
  });
});
