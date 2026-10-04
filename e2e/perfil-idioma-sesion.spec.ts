// FIX-3 §C.6 / §4.2 C: saving the language must never log you out. Blocks
// the merge. The mock can't reproduce Supabase's real cookie refresh, so run
// this against a Vercel Preview with a real test account too before
// publishing.

import { expect, test, type Page } from '@playwright/test';
import { asRole } from './utils/roles';

test.describe.configure({ mode: 'serial' });

function watchSignIn(page: Page): string[] {
  const hits: string[] = [];
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame() && /\/sign-in/.test(f.url())) hits.push(f.url());
  });
  page.on('request', (r) => {
    if (r.isNavigationRequest() && /\/sign-in/.test(r.url())) hits.push(r.url());
  });
  return hits;
}

async function sessionCookies(page: Page) {
  return (await page.context().cookies()).filter((c) => /^sb-.*-auth-token/.test(c.name));
}

async function saveLanguage(page: Page, to: 'en' | 'es') {
  const select = page.locator('#idioma');
  await select.selectOption(to);
  await page.getByRole('button', { name: to === 'en' ? 'Guardar cambios' : 'Save changes' }).click();
}

test.describe('Mi perfil · language and session', () => {
  asRole('free');

  test('change to English and back, three times: never through /sign-in, still signed in', async ({ page }) => {
    const signIn = watchSignIn(page);
    const before = await sessionCookies(page);
    for (let round = 0; round < 3; round++) {
      await page.goto('/app/settings/perfil');
      await expect(page.getByRole('heading', { level: 1, name: 'Mi perfil' })).toBeVisible();
      await saveLanguage(page, 'en');
      await expect(page).toHaveURL(/\/en\/app\/settings\/perfil$/);
      await expect(page.getByRole('status').filter({ hasText: 'Done, your changes are saved.' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 1, name: 'My profile' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
      // Still a valid session: Mi cuenta in English shows Sign out.
      await page.goto('/en/app/settings');
      await expect(page.getByRole('button', { name: 'Sign out' }).first()).toBeVisible();
      await page.reload();
      await expect(page.getByRole('button', { name: 'Sign out' }).first()).toBeVisible();
      await page.goto('/en/app');
      await page.goto('/en/app/settings/perfil');
      await saveLanguage(page, 'es');
      await expect(page).toHaveURL(/\/app\/settings\/perfil$/);
      await expect(page.getByRole('status').filter({ hasText: 'Listo, guardamos tus cambios.' })).toBeVisible();
    }
    expect(signIn).toEqual([]);
    expect((await sessionCookies(page)).length).toBeGreaterThanOrEqual(before.length);
  });

  test('name and language at once, then a save with no language change stays put', async ({ page }) => {
    const signIn = watchSignIn(page);
    await page.goto('/app/settings/perfil');
    const name = page.getByLabel('Tu nombre');
    const original = await name.inputValue();
    const save = page.getByRole('button', { name: 'Guardar cambios' });
    await expect(save).toBeDisabled();
    await name.fill(`${original} QA`);
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByRole('status').filter({ hasText: 'Listo, guardamos tus cambios.' })).toBeVisible();
    await expect(page).toHaveURL(/\/app\/settings\/perfil$/);
    await expect(save).toBeDisabled();
    await page.reload();
    await expect(page.getByLabel('Tu nombre')).toHaveValue(`${original} QA`);
    // Name + language together.
    await page.getByLabel('Tu nombre').fill(original);
    await saveLanguage(page, 'en');
    await expect(page).toHaveURL(/\/en\/app\/settings\/perfil$/);
    await expect(page.getByLabel('Your name')).toHaveValue(original);
    await saveLanguage(page, 'es');
    await expect(page).toHaveURL(/\/app\/settings\/perfil$/);
    expect(signIn).toEqual([]);
    // The old browser-only prefs key is gone after the first visit.
    expect(await page.evaluate(() => localStorage.getItem('chalyb:settings:prefs'))).toBeNull();
  });

  test('a stale localStorage "en" never shows English on a Spanish account', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('chalyb:settings:prefs', '{"locale":"en"}'));
    await page.goto('/app/settings/perfil');
    await expect(page.locator('#idioma')).toHaveValue('es');
    await expect(page.locator('#idioma option:checked')).toHaveText('Español (México)');
    // No fake controls: no 2FA switch.
    await expect(page.getByText(/dos pasos|2FA|TOTP/)).toHaveCount(0);
  });
});
