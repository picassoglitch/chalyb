import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';

/** 0 serious/critical axe violations (rebuild prompt §6.3). */
export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
  expect(blocking, `axe on ${page.url()}`).toEqual([]);
}

/** No horizontal scroll at 360px (rebuild prompt §6.2). Only meaningful in the
 *  mobile-360 project; a screenshot goes into the report for the PR. */
export async function expectNoOverflow(page: Page, testInfo: TestInfo) {
  if (testInfo.project.name !== 'mobile-360') return;
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width, `horizontal scroll on ${page.url()}`).toBeLessThanOrEqual(360);
  await testInfo.attach(`360-${new URL(page.url()).pathname.replace(/\W+/g, '_')}`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
}
