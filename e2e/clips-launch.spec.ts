// Clips never hands off to another app or tab anymore (WS-11, F1/F3).
//
//  - /app/engines/chalybclip answers 307 to /app/clips and keeps the query
//    string (TOOLS-SPEC §2), in every mode.
//  - Without the engine's job API (TOOL_HUB_MODE_CHALYBCLIP off, i.e. any
//    run that is not E2E_CLIPS_MODE=mock), /app/clips shows "Clips no abrió
//    esta vez" inside the tool, with a CLP-#### support code, in one tab.

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

  test('engine without API: ToolErrorState with a support code, no new tab', async ({
    page,
    context,
  }) => {
    test.skip(MOCK, 'only meaningful when the server runs Clips without the mock adapter');
    await page.goto('/app/clips');
    await expect(page.getByRole('heading', { name: 'Clips no abrió esta vez' })).toBeVisible();
    await expect(page.getByText(/CLP-\d{4}/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Intentar otra vez' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Hablar con una persona' })).toHaveAttribute(
      'href',
      /\/app\/help\?codigo=CLP-\d{4}/,
    );
    await expect(page.getByText(/pestaña nueva|Abrir/)).toHaveCount(0);
    expect(context.pages()).toHaveLength(1);
  });
});
