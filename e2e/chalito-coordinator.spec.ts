// Chalito coordinator mode (ADR 0025 §6): the "Equipo" screen. Read-only: it opens, shows the goal
// box (or why it can't: no paired computer, or this browser isn't activated yet), and sends nothing.

import { test, expect } from '@playwright/test';
import { asRole } from './utils/roles';

test.describe('signed in', () => {
  asRole('pro');

  test('Equipo opens from Inicio and shows the goal box or what is missing', async ({ page }) => {
    await page.goto('/app/chalito/equipo');
    await expect(
      page
        .getByTestId('coord-home')
        .or(page.getByTestId('gate-unpaired'))
        .or(page.getByTestId('activate')),
    ).toBeVisible({ timeout: 30_000 });
    if (await page.getByTestId('coord-home').isVisible()) {
      await expect(page.getByTestId('coord-goal').or(page.getByTestId('coord-no-computers'))).toBeVisible();
      // Nothing is sent without a goal.
      const send = page.getByTestId('coord-send');
      if (await send.isVisible()) await expect(send).toBeDisabled();
    }
  });
});
