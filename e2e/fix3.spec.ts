// WS-9 · FIX-3 (FIX-3-PAGINAS-SPEC §4.2–§4.3): the three pages that still
// rendered the dark legacy shell. Rendered checks, per role.

import { expect, test, type Page } from '@playwright/test';
import { asRole } from './utils/roles';

/** §4.3: no legacy shell, no monospace, no small or uppercase text except
 *  the two approved labels. */
async function noLegacyStyle(page: Page) {
  const bad = await page.evaluate(() => {
    const out: string[] = [];
    if (document.querySelector('.ch-legacy, .cc-shell, [class*="cc-mod-"]')) out.push('legacy shell');
    const main = document.querySelector('main') ?? document.body;
    for (const el of main.querySelectorAll<HTMLElement>('*')) {
      if (!el.offsetParent && el.tagName !== 'BODY') continue;
      if (el.closest('.ch-consent, [role="dialog"], .ch-sr')) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
      if (!own) continue;
      const cs = getComputedStyle(el);
      const ok = el.closest('.ch-ghead, .ch-plan__k');
      if (/mono/i.test(cs.fontFamily)) out.push(`mono: ${el.textContent!.trim().slice(0, 30)}`);
      if (!ok && cs.textTransform === 'uppercase') out.push(`upper: ${el.textContent!.trim().slice(0, 30)}`);
      if (!ok && parseFloat(cs.fontSize) < 16) out.push(`small ${cs.fontSize}: ${el.textContent!.trim().slice(0, 30)}`);
    }
    return out;
  });
  expect(bad).toEqual([]);
}

test.describe('A · Mi plan, Gratis', () => {
  asRole('free');
  test('/app/subscription shows mockup 70: the plan, the account rows and one offer', async ({ page }) => {
    await page.goto('/app/subscription');
    await expect(page).toHaveURL(/\/app\/subscription$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Mi plan' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Gratis', exact: true })).toBeVisible();
    await expect(page.getByText('Tu cuenta Gratis')).toBeVisible();
    await expect(page.getByText(/Telemetry|profiles\.tier|EL MÁS ELEGIDO|1 herramienta incluida/i)).toHaveCount(0);
    await noLegacyStyle(page);
  });
});

test.describe('A · Mi plan, paid', () => {
  asRole('pro');
  test('/app/subscription goes to /app/billing, keeping ?status', async ({ page }) => {
    await page.goto('/app/subscription?status=success');
    await expect(page).toHaveURL(/\/app\/billing\?status=success$/);
    await expect(page.getByText('Listo, tu plan ya está activo.')).toBeVisible();
    await noLegacyStyle(page);
  });
});
