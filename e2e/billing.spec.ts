// P2 billing (SCR-12…18, 30). Runs against a server with TRIAL_FLOW_ENABLED
// and its prerequisites (the local mock run sets them); real Mercado Pago
// charges need E2E_ALLOW_MUTATIONS=1 against a sandbox preview.

import { test, expect } from '@playwright/test';
import { asRole, type Role } from './utils/roles';
import { expectNoLeaks } from './utils/no-leaks';
import { expectAccessible, expectNoOverflow } from './utils/a11y';

const FLOW = process.env.E2E_TRIAL_FLOW === '1';
const FORBIDDEN_PRICE = /2 meses gratis|\$624\/mes/;

test.describe('public /planes', () => {
  test('real totals, IVA stated, no "2 meses gratis", Mensual in 1 tap', async ({ page }, info) => {
    await page.goto('/planes');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Precios en MXN, IVA incluido.')).toBeVisible();
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(FORBIDDEN_PRICE);
    expect(body).toMatch(/\$9,970 MXN al año/);
    await page.getByRole('radio', { name: 'Mensual' }).click();
    await expect(page.getByText(/MXN al mes/).first()).toBeVisible();
    await expectNoOverflow(page, info);
    await expectAccessible(page);
  });
});

test.describe('trial path, as free', () => {
  asRole('free');
  test.skip(!FLOW, 'E2E_TRIAL_FLOW=1 (server with TRIAL_FLOW_ENABLED and its prerequisites)');

  test('Tu prueba: nothing annual preselected; Mensual from a monthly card; live charge block', async ({
    page,
  }, info) => {
    await page.goto('/app/prueba?interval=year');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Prueba Pro gratis de 7 días');
    await expect(page.getByRole('radio', { name: /^Pro anual —/ })).not.toBeChecked();
    await expect(page.getByRole('radio', { name: /^Pro mensual —/ })).not.toBeChecked();
    await expect(page.getByText('Elegiste Pro anual en la tarjeta')).toBeVisible();
    await page.getByRole('radio', { name: /^Pro anual —/ }).check();
    await expect(page.getByText(/por 1 año de Pro/)).toBeVisible();
    await page.goto('/app/prueba?interval=month');
    await expect(page.getByRole('radio', { name: /^Pro mensual —/ })).toBeChecked();
    await expect(page.getByText(/Hoy pagas \$0\./)).toBeVisible();
    await expect(page.getByText(/por tu primer mes de Pro/)).toBeVisible();
    await expect(page.getByText(/Tu prueba gratis de 7 días termina el/)).toBeVisible();
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/mes gratis|o paga mes a mes/);
    await expectNoLeaks(page);
    await expectNoOverflow(page, info);
    await expectAccessible(page);
  });

  test('Pago: the consent box is unchecked and the button disabled until it is', async ({
    page,
  }) => {
    await page.goto('/app/prueba/pago?plan=pro_month');
    const box = page.getByRole('checkbox');
    await expect(box).not.toBeChecked();
    await expect(page.getByRole('button', { name: 'Empezar mis 7 días gratis' })).toBeDisabled();
    await expect(page.getByText(/Primer cobro:/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Quién vende' })).toBeVisible();
  });

  test('Pago without a plan goes back to the picker (no default plan)', async ({ page }) => {
    await page.goto('/app/prueba/pago');
    await expect(page).toHaveURL(/\/app\/prueba(\?|$)/);
  });

  test('a direct POST without consent is refused with 422', async ({ request }) => {
    const res = await request.post('/api/billing/trial', {
      data: { planKey: 'pro_year', cardTokenId: 'tok' },
    });
    expect(res.status()).toBe(422);
  });

  test('Quién vende opens from the payment step', async ({ page }) => {
    await page.goto('/app/prueba/pago?plan=pro_year');
    await page.getByRole('button', { name: 'Quién vende' }).click();
    await expect(page.getByRole('dialog', { name: 'Quién vende' })).toBeVisible();
  });
});

const STATES: [Role, RegExp][] = [
  ['pro', /Pro mensual — todo incluido/],
  ['vip', /VIP — todo incluido/],
  ['trial', /Prueba Pro gratis/],
  ['pro_annual', /Pro anual — todo incluido/],
  ['past_due', /No pudimos cobrar/],
];

for (const [role, heading] of STATES) {
  test.describe(`Mi plan as ${role}`, () => {
    asRole(role);
    test('shows its state, IVA, and a cancel row while charges remain', async ({ page }, info) => {
      await page.goto('/app/billing');
      await expect(page.getByRole('heading', { level: 2, name: heading })).toBeVisible();
      await expect(page.getByText('Precios en MXN, IVA incluido.')).toBeVisible();
      await expect(
        page.getByRole('button', { name: /Cancelar (suscripción|prueba)/ }),
      ).toBeVisible();
      expect(await page.locator('body').innerText()).not.toMatch(/MP #|\btier\b|\/app\//);
      await expectNoLeaks(page);
      await expectNoOverflow(page, info);
      await expectAccessible(page);
    });

    test('cancel: 2 clicks, "Sí, cancelar" visible next to "Seguir con…"', async ({ page }) => {
      await page.goto('/app/billing');
      await page.getByRole('button', { name: /Cancelar (suscripción|prueba)/ }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('button', { name: 'Sí, cancelar' })).toBeInViewport();
      await expect(dialog.getByRole('button', { name: /Seguir con/ })).toBeInViewport();
    });
  });
}

test.describe('Mi plan as cancelled', () => {
  asRole('cancelled');
  test('access until the end, no more charges, no cancel row', async ({ page }) => {
    await page.goto('/app/billing');
    await expect(page.getByText('No habrá más cobros.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Cancelar/ })).toHaveCount(0);
  });
});

test.describe('banners', () => {
  for (const [role, text] of [
    ['trial', /Prueba Pro gratis · El .* se cobrarán \$9,970 MXN/],
    ['past_due', /No pudimos cobrar tu plan/],
    ['pro_annual', /se renueva el/],
  ] as [Role, RegExp][]) {
    test.describe(role, () => {
      asRole(role);
      test(`shows the ${role} banner`, async ({ page }) => {
        await page.goto('/app');
        await expect(page.getByText(text).first()).toBeVisible();
      });
    });
  }
});
