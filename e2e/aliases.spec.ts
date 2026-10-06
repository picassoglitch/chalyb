// Vanity paths and /engines (P0-9, P0-13).

import { test, expect } from '@playwright/test';

const CASES: [string, string, number[]][] = [
  ['/engines', '/#herramientas', [308]],
  ['/en/engines', '/en/#herramientas', [308]],
  ['/sign-up', '/sign-in?mode=signup', [308]],
  ['/en/sign-up', '/en/sign-in?mode=signup', [308]],
  // WS-12: the legal short paths are permanent now (P6 made /legal/* canonical).
  ['/terminos', '/legal/terms', [308]],
  ['/privacidad', '/legal/privacy', [308]],
  ['/en/terminos', '/en/legal/terms', [308]],
  ['/en/privacidad', '/en/legal/privacy', [308]],
  ['/suscripcion', '/legal/subscription', [308]],
  ['/uso-aceptable', '/legal/acceptable-use', [308]],
  ['/en/suscripcion', '/en/legal/subscription', [308]],
  ['/suscripcion/v1-0', '/legal/subscription/v1-0', [308]],
  ['/terminos/v1-0', '/legal/terms/v1-0', [308]],
  ['/terminos/cambios/v1-0', '/legal/terms/changes/v1-0', [308]],
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
