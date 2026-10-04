import type { Page } from '@playwright/test';

/** Answer the cookie banner ("Solo necesarias") if it's showing, so a test
 *  about something else doesn't fight it for the bottom of a 360 px screen.
 *  The banner itself is covered by public-site.spec.ts. */
export async function dismissCookies(page: Page) {
  const btn = page.getByRole('dialog').getByRole('button', { name: 'Solo necesarias' });
  await btn.waitFor({ timeout: 3_000 }).catch(() => {});
  if (await btn.isVisible().catch(() => false)) await btn.click();
}
