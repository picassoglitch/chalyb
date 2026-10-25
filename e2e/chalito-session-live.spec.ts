// Chalito live session page (/rc-style transcript, 2026-10-21). Read-only: it opens a made-up
// session id, never sends a prompt, a Stop or a decision.

import { test, expect } from '@playwright/test';
import { asRole } from './utils/roles';

const PATH = '/app/chalito/sesiones/ses_e2e_unknown';

test.describe('signed in', () => {
  asRole('pro');

  test('a session link opens the live page, "not found", or says what is missing; no sideways scroll', async ({
    page,
  }) => {
    await page.goto(PATH);
    const live = page.getByTestId('session-live');
    await expect(
      live
        .or(page.getByText(/No encontramos esa sesión|We couldn.t find that session/))
        .or(page.getByTestId('gate-unpaired'))
        .or(page.getByTestId('gate-error'))
        .or(page.getByTestId('recover'))
        .or(page.getByTestId('activate').or(page.getByTestId('approve-browser')))
        // Mock Supabase has no Chalito api behind it: the hub's SSO into Chalito says so.
        .or(page.getByTestId('chalito-sso-failed')),
    ).toBeVisible({ timeout: 30_000 });
    if (await live.isVisible()) {
      await expect(page.getByTestId('session-pill')).toBeVisible();
      await expect(page.getByTestId('composer')).toBeVisible();
      // Nothing is sent without text.
      await expect(page.getByTestId('composer').getByRole('button')).toBeDisabled();
    }
    // Works at 360px: the page never scrolls sideways.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
