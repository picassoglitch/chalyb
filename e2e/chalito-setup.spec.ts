// Chalito's setup checklist (First Run D, ADR 0028 §6): "Pon a trabajar a Chalito" on Inicio,
// six steps read from real state, one button for the step that's next. Read-only: it signs in
// as a QA account and looks; it never activates a browser or pairs anything. A role without
// credentials in the env is skipped (utils/roles), so this runs only where they're set.

import { test, expect } from '@playwright/test';
import { asRole } from './utils/roles';
import { chalitoScreen } from './utils/chalito';

const STEPS = ['account', 'browser', 'computer', 'ai', 'folder', 'firstTask'];
/** Where the open step's button goes (SetupChecklist.tsx ACTIONS). */
const GOES_TO: Record<string, RegExp> = {
  browser: /\/app\/chalito\/dispositivos$/,
  computer: /\/app\/chalito\/descargar$/,
  ai: /\/app\/chalito\/ajustes$/,
  firstTask: /\/app\/chalito\/sesiones\/nueva\?first=1$/,
};

test.describe('a signed-in account', () => {
  asRole('free');

  test('Inicio shows the checklist from real state, with one next step and its button', async ({
    page,
  }) => {
    await page.goto('/app/chalito');
    const list = page.getByTestId('setup-checklist');
    // An account that already finished setup has no checklist: nothing left to check then.
    if (
      !(await list.waitFor({ timeout: 15_000 }).then(
        () => true,
        () => false,
      ))
    ) {
      test.skip(true, 'this QA account has already finished setup');
      return;
    }
    const items = list.locator('li[data-step]');
    await expect(items).toHaveCount(STEPS.length);
    expect(await items.evaluateAll((els) => els.map((e) => e.getAttribute('data-step')))).toEqual(
      STEPS,
    );
    // Signed in, so the account is done; nothing on the page can tick a step.
    await expect(list.locator('li[data-step="account"]')).toHaveAttribute('data-done', 'true');
    await expect(list.locator('input[type="checkbox"]')).toHaveCount(0);

    const current = list.locator('li[aria-current="step"]');
    await expect(current).toHaveCount(1);
    const step = (await current.getAttribute('data-step'))!;
    const go = GOES_TO[step];
    if (go) {
      const link = page.getByTestId(`setup-go-${step}`);
      await expect(link).toBeVisible();
      expect(await link.getAttribute('href')).toMatch(go);
    }
  });

  test('Dispositivos without a computer says so and offers the download', async ({ page }) => {
    await page.goto('/app/chalito/dispositivos');
    const none = page.getByTestId('no-computer');
    const list = page.getByTestId('device').first();
    const gate = page.getByTestId('activate').or(page.getByTestId('approve-browser')).or(page.getByTestId('gate-unpaired'));
    await expect(chalitoScreen(page, none.or(list).or(gate))).toBeVisible({ timeout: 20_000 });
    if (await none.isVisible()) {
      expect(await page.getByTestId('no-computer-download').getAttribute('href')).toMatch(
        /\/app\/chalito\/descargar$/,
      );
    }
  });

  test('the first task link opens New Session without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/app/chalito/sesiones/nueva?first=1');
    await expect(
      chalitoScreen(
        page,
        page
          .getByTestId('new-session')
          .or(page.getByTestId('no-computers'))
          .or(page.getByTestId('activate').or(page.getByTestId('approve-browser')))
          .or(page.getByTestId('gate-unpaired')),
      ),
    ).toBeVisible({ timeout: 20_000 });
    expect(errors).toEqual([]);
  });
});
