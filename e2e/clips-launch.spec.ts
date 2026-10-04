// Clips never hands off to another app or tab anymore (WS-11, F1/F3).
//
//  - /app/engines/chalybclip answers 307 to /app/clips and keeps the query
//    string (TOOLS-SPEC §2), in every mode.
//  - Without the engine's job API (TOOL_HUB_MODE_CHALYBCLIP off, i.e. any
//    run that is not E2E_CLIPS_MODE=mock), /app/clips hands off to the Clips
//    app over SSO (/auth/launch/chalybclip?via=hub) until OPS-13 lands.

import { test, expect } from '@playwright/test';
import { asRole } from './utils/roles';

const MOCK = process.env.E2E_CLIPS_MODE === 'mock';

test.describe('as pro', () => {
  asRole('pro');

  test('the old Clips URL redirects 307 into the app, query kept', async ({ page }) => {
    const res = await page.request.get('/app/engines/chalybclip?desde=correo', { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers().location).toMatch(/\/app\/clips\?desde=correo$/);
  });

  test('engine without API: hands off to the Clips app over SSO', async ({ page }) => {
    test.skip(MOCK, 'only meaningful when the server runs Clips without the mock adapter');
    const res = await page.request.get('/app/clips', { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers().location).toMatch(/\/auth\/launch\/chalybclip\?via=hub$/);
  });
});
