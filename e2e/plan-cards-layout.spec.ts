// Plan cards at every width (PRICING-CARDS-SPEC §5.4, WS-4/WS-7): no spill,
// every toggle option inside the screen and its own box, and each price on
// one line, on /planes, the landing's #precios and the app's Planes. With
// Lealtad on (LEALTAD_ENABLED) the three-option toggle is checked too, with
// Lealtad selected: it used to push "Lealtad" off-screen below 600 px.
// Runs once, in desktop-chromium; it sets its own viewports.

import { test, expect, type Page } from '@playwright/test';
import { asRole } from './utils/roles';
import { expectAccessible } from './utils/a11y';

const WIDTHS = [320, 390, 1024, 1280, 1440, 1920] as const;

async function expectLaidOut(page: Page, what: string) {
  const r = await page.evaluate(() => {
    const vw = window.innerWidth;
    const opts = [...document.querySelectorAll<HTMLElement>('.ch-pc-toggle__opt')].map((o) => {
      const b = o.getBoundingClientRect();
      return {
        text: o.innerText.replace(/\s+/g, ' ').trim(),
        inside: b.left >= -0.5 && b.right <= vw + 0.5,
        fits: o.scrollWidth <= o.clientWidth + 1,
      };
    });
    const prices = [...document.querySelectorAll<HTMLElement>('.ch-pc__amt')]
      .filter((p) => p.offsetParent !== null)
      .map((p) => ({ text: p.innerText, lines: p.getClientRects().length }));
    return { vw, scroll: document.documentElement.scrollWidth, opts, prices };
  });
  expect(r.scroll, `${what}: horizontal scroll`).toBeLessThanOrEqual(r.vw);
  for (const o of r.opts) {
    expect(o.inside, `${what}: toggle "${o.text}" off-screen`).toBe(true);
    expect(o.fits, `${what}: toggle "${o.text}" spills its box`).toBe(true);
  }
  for (const p of r.prices) expect(p.lines, `${what}: price ${p.text} wraps`).toBe(1);
}

async function checkAllWidths(page: Page, path: string) {
  test.skip(test.info().project.name !== 'desktop-chromium', 'sets its own viewports');
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(path);
    await page.locator('.ch-pc-wrap').first().waitFor();
    await expectLaidOut(page, `${path} @${width}`);
    const lealtad = page.getByRole('radio', { name: /^(Lealtad|Loyalty)/ });
    if (await lealtad.count()) {
      // The three-option toggle, before and after choosing Lealtad.
      await lealtad.click();
      await expectLaidOut(page, `${path} @${width} Lealtad`);
      // The pill is part of each option's accessible name: axe once, on a phone.
      if (width === 390) await expectAccessible(page);
    }
  }
}

test.describe('plan cards layout', () => {
  for (const path of ['/planes', '/en/planes', '/#precios'])
    test(`${path} at 320–1920`, async ({ page }) => {
      await checkAllWidths(page, path);
    });

  test.describe('signed in', () => {
    asRole('free');
    test('/app/planes at 320–1920', async ({ page }) => {
      await checkAllWidths(page, '/app/planes');
    });
  });
});
