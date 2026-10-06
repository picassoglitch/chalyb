// Mi cuenta → Cerrar mi cuenta (Términos y Condiciones §13.1, Paquetes §5.2)
// and Mi cuenta → Cuentas conectadas (Aviso de privacidad §6).
//  - The closure screen shows the unused extra credits and what happens to
//    the plan before the button; the button waits for the box.
//  - Free (mock backend only): confirming files the request, and the screen
//    then shows it open instead of the form.
//  - Pro: the plan is cancelled by the closure; the screen says so and
//    offers Mi plan for someone who only wants to stop paying.

import { test, expect } from '@playwright/test';
import { asRole } from './utils/roles';

const MOCK = process.env.E2E_MOCK_BACKEND === '1';

test.describe('as free', () => {
  asRole('free');

  test('Mi cuenta links the closure screen; credits and plan first; box before button', async ({
    page,
  }) => {
    await page.goto('/app/settings');
    await page.getByRole('link', { name: /Cerrar mi cuenta/ }).click();
    await expect(page).toHaveURL(/\/app\/settings\/cerrar-cuenta$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Cerrar mi cuenta' })).toBeVisible();
    await expect(page.getByTestId('close-credits')).toHaveText(
      /créditos extra sin usar|No pudimos leer/,
    );
    await expect(page.getByText('No tienes un plan de pago.')).toBeVisible();
    const cta = page.getByRole('button', { name: 'Cerrar mi cuenta' });
    await expect(cta).toBeDisabled();
    await page.getByRole('checkbox').check();
    await expect(cta).toBeEnabled();
  });

  test('confirming files the request; the screen then shows it open', async ({ page }) => {
    test.skip(!MOCK, 'E2E_MOCK_BACKEND=1 not set (files a closure request)');
    await page.goto('/app/settings/cerrar-cuenta');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Cerrar mi cuenta' }).click();
    await expect(page.getByRole('status')).toContainText('Recibimos tu solicitud');
    await page.reload();
    await expect(page.getByRole('status')).toContainText('Ya pediste cerrar tu cuenta');
    await expect(page.getByRole('button', { name: 'Cerrar mi cuenta' })).toHaveCount(0);
  });
});

test.describe('as pro', () => {
  asRole('pro');

  test('the closure cancels the plan; Mi plan is offered to only stop paying', async ({ page }) => {
    await page.goto('/app/settings/cerrar-cuenta');
    await expect(page.getByText(/cancelamos tu plan y no habrá más cobros/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ir a Mi plan' })).toHaveAttribute(
      'href',
      /\/app\/billing$/,
    );
  });

  test('Mi cuenta has Cuentas conectadas, leading to Ajustes de Clips', async ({ page }) => {
    await page.goto('/app/settings');
    await expect(page.getByRole('link', { name: /Cuentas conectadas/ })).toHaveAttribute(
      'href',
      /\/app\/clips\/ajustes#set-accts$/,
    );
  });
});
