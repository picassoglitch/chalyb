// ADR 0031 (chalito): "Automático" on Nueva sesión and the routing rules in Ajustes. Read-only: nothing is sent.

import { test, expect } from '@playwright/test';
import { asRole } from './utils/roles';
import { chalitoScreen } from './utils/chalito';

test.describe('signed in', () => {
  asRole('pro');

  test('Nueva sesión offers Automático, and it says where the session would run', async ({ page }) => {
    await page.goto('/app/chalito/sesiones/nueva');
    await expect(
      chalitoScreen(
        page,
        page.getByTestId('new-session').or(page.getByTestId('no-computers')).or(page.getByTestId('activate')),
      ),
    ).toBeVisible({ timeout: 30_000 });
    if (!(await page.getByTestId('new-session').isVisible())) return;
    await page.locator('#ns-computer').selectOption('auto');
    await expect(page.locator('#ns-computer')).toHaveValue('auto');
    await page.locator('#ns-workspace').fill('una-carpeta-que-no-existe');
    await expect(page.getByTestId('auto-choice')).toBeVisible();
    await expect(page.getByRole('button', { name: /^(Iniciar sesión|Start session)$/ })).toBeDisabled();
  });

  test('Ajustes lists where new sessions run', async ({ page }) => {
    await page.goto('/app/chalito/ajustes');
    await expect(chalitoScreen(page, page.getByTestId('routing-rules').or(page.getByTestId('activate')))).toBeVisible({
      timeout: 30_000,
    });
  });
});
