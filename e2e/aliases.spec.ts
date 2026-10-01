// Vanity paths and /engines (P0-9, P0-13).

import { test, expect } from '@playwright/test';

const CASES: [string, string, number[]][] = [
  ['/engines', '/#herramientas', [308]],
  ['/en/engines', '/en/#herramientas', [308]],
  ['/sign-up', '/sign-in?mode=signup', [308]],
  ['/en/sign-up', '/en/sign-in?mode=signup', [308]],
  ['/terminos', '/legal/terms', [307]],
  ['/privacidad', '/legal/privacy', [307]],
  ['/en/terminos', '/en/legal/terms', [307]],
  ['/en/privacidad', '/en/legal/privacy', [307]],
];

for (const [from, to, statuses] of CASES) {
  test(`${from} → ${to}`, async ({ request }) => {
    const res = await request.get(from, { maxRedirects: 0 });
    expect(statuses).toContain(res.status());
    const location = new URL(res.headers()['location']!, 'http://x');
    expect(location.pathname + location.search).toBe(to.split('#')[0]);
    const target = await request.get(to.split('#')[0]!);
    expect(target.status()).toBe(200);
  });
}
