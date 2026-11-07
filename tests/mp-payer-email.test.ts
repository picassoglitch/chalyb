// Owner trials 2026-11-07: every MP validation charge was cc_rejected_high_risk.
// MP rejects a preapproval whose payer_email isn't the payer's MP account email.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { choosePayerEmail, cleanPayerEmail, payerIsSeller } from '@/lib/payments/payer-email';
import { mpPayerEmailEditable } from '@/lib/config/flags';

const TOK_TEST = 'TEST-1234567890123456-100125-0123456789abcdef0123456789abcdef-123456789';
const DEVICE = `armor.${'4f1c9b2e7d'.repeat(22)}a6c3b`;
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

interface Captured {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

/** Runs `fn` through the real SDK with fetch answering by URL. */
async function withFetch<T>(
  answer: (url: string) => { status: number; json: unknown },
  env: Record<string, string>,
  fn: () => Promise<T>,
): Promise<{ calls: Captured[]; result?: T; error?: unknown }> {
  const calls: Captured[] = [];
  const real = globalThis.fetch;
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    saved[k] = process.env[k];
    process.env[k] = v;
  }
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({
      url: String(url),
      headers: Object.fromEntries(
        Object.entries((init.headers ?? {}) as Record<string, string>).map(([k, v]) => [
          k.toLowerCase(),
          v,
        ]),
      ),
      body: init.body ? JSON.parse(String(init.body)) : {},
    });
    const { status, json } = answer(String(url));
    return new Response(JSON.stringify(json), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  try {
    return { calls, result: await fn() };
  } catch (error) {
    return { calls, error };
  } finally {
    globalThis.fetch = real;
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

// ── cleanPayerEmail ───────────────────────────────────────────────────────

test('cleanPayerEmail keeps a real address, trimmed, and drops everything else', () => {
  assert.equal(cleanPayerEmail('  ana.lopez+mp@gmail.com '), 'ana.lopez+mp@gmail.com');
  assert.equal(cleanPayerEmail('Ana@Hotmail.COM'), 'Ana@Hotmail.COM');
  for (const bad of ['', '   ', 'ana', 'ana@', '@gmail.com', 'ana@gmail', 'a b@x.com', 'a@b.c', 42, null, undefined, {}]) {
    assert.equal(cleanPayerEmail(bad), null, String(bad));
  }
  assert.equal(cleanPayerEmail(`${'a'.repeat(250)}@x.com`), null);
  assert.equal(cleanPayerEmail('x<script>@a.com'), null);
});

// ── choosePayerEmail ──────────────────────────────────────────────────────

const ACCOUNT = 'aldo@chalyb.com';

test('flag off: always the account email, whatever the form sent', () => {
  assert.deepEqual(
    choosePayerEmail({ accountPayerEmail: ACCOUNT, formEmail: 'mp@gmail.com', editable: false, mpEnv: 'prod' }),
    { email: ACCOUNT, source: 'account' },
  );
});

test('flag on in prod: a valid, different email from the form goes to MP', () => {
  assert.deepEqual(
    choosePayerEmail({ accountPayerEmail: ACCOUNT, formEmail: ' mp@gmail.com ', editable: true, mpEnv: 'prod' }),
    { email: 'mp@gmail.com', source: 'form' },
  );
});

test('flag on: an invalid, empty or same email keeps the account one', () => {
  for (const formEmail of ['', 'nope', null, undefined, 'ALDO@chalyb.com']) {
    assert.deepEqual(
      choosePayerEmail({ accountPayerEmail: ACCOUNT, formEmail, editable: true, mpEnv: 'prod' }),
      { email: ACCOUNT, source: 'account' },
      String(formEmail),
    );
  }
});

test('flag on in test: MP test buyer stays (a real email would break sandbox)', () => {
  const testBuyer = 'test_user_123@testuser.com';
  assert.deepEqual(
    choosePayerEmail({ accountPayerEmail: testBuyer, formEmail: 'mp@gmail.com', editable: true, mpEnv: 'test' }),
    { email: testBuyer, source: 'account' },
  );
});

test('payerIsSeller compares case-insensitively and is null when unknown', () => {
  assert.equal(payerIsSeller('Aldo@Gmail.com', 'aldo@gmail.com '), true);
  assert.equal(payerIsSeller('ana@gmail.com', 'aldo@gmail.com'), false);
  assert.equal(payerIsSeller('ana@gmail.com', null), null);
});

// ── flag ──────────────────────────────────────────────────────────────────

test('MP_PAYER_EMAIL_EDITABLE defaults off', () => {
  const saved = process.env.MP_PAYER_EMAIL_EDITABLE;
  try {
    delete process.env.MP_PAYER_EMAIL_EDITABLE;
    assert.equal(mpPayerEmailEditable(), false);
    process.env.MP_PAYER_EMAIL_EDITABLE = 'true';
    assert.equal(mpPayerEmailEditable(), true);
    process.env.MP_PAYER_EMAIL_EDITABLE = '0';
    assert.equal(mpPayerEmailEditable(), false);
  } finally {
    if (saved === undefined) delete process.env.MP_PAYER_EMAIL_EDITABLE;
    else process.env.MP_PAYER_EMAIL_EDITABLE = saved;
  }
});

// ── through the real SDK ──────────────────────────────────────────────────

test('the chosen email is the payer_email MP receives, next to the device id', async () => {
  const { getMercadoPagoIsolated } = await import('@/lib/payments/mercadopago');
  const { meliSessionOptions } = await import('@/lib/payments/device-session');
  const payer = choosePayerEmail({
    accountPayerEmail: ACCOUNT,
    formEmail: 'mi.cuenta.mp@gmail.com',
    editable: true,
    mpEnv: 'prod',
  });
  const { calls, error } = await withFetch(
    () => ({ status: 201, json: { id: 'pre_1', status: 'authorized' } }),
    { MERCADOPAGO_ACCESS_TOKEN: TOK_TEST, MP_ENV: 'test' },
    () =>
      getMercadoPagoIsolated().preapproval.create({
        body: {
          reason: 'Chalyb Pro',
          payer_email: payer.email,
          card_token_id: 'tok_1',
          auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: 1099, currency_id: 'MXN' },
          status: 'authorized',
        },
        requestOptions: meliSessionOptions(DEVICE),
      }),
  );
  assert.equal(error, undefined);
  assert.equal(calls.length, 1);
  assert.match(calls[0]!.url, /\/preapproval\/?$/);
  assert.equal(calls[0]!.body.payer_email, 'mi.cuenta.mp@gmail.com');
  assert.equal(calls[0]!.headers['x-meli-session-id'], DEVICE);
});

test('sellerMatches remembers the seller email for the self-charge check', async () => {
  const { sellerMatches, cachedSellerEmail } = await import('@/lib/payments/mercadopago');
  const env = {
    MERCADOPAGO_ACCESS_TOKEN: `${TOK_TEST}-seller`,
    MP_ENV: 'test',
    MP_EXPECTED_SELLER_ID: '123456789',
  };
  const { calls, result } = await withFetch(
    (url) =>
      /\/users\/me/.test(url)
        ? { status: 200, json: { id: 123456789, email: 'Vendedor@Gmail.com' } }
        : { status: 404, json: {} },
    env,
    async () => {
      const ok = await sellerMatches();
      return { ok, email: cachedSellerEmail() };
    },
  );
  assert.ok(calls.some((c) => /\/users\/me/.test(c.url)));
  assert.equal(result?.ok, true);
  assert.equal(result?.email, 'Vendedor@Gmail.com');
  assert.equal(payerIsSeller('vendedor@gmail.com', result!.email), true);
});

// ── wiring ────────────────────────────────────────────────────────────────

test('both card routes pass the cleaned form email; startSubscription logs booleans only', () => {
  for (const route of ['src/app/api/billing/trial/route.ts', 'src/app/api/billing/change/route.ts']) {
    assert.match(read(route), /mpPayerEmail: cleanPayerEmail\(body\.mpEmail\)/, route);
  }
  const start = read('src/lib/billing/start-subscription.ts');
  assert.match(start, /choosePayerEmail\(\{[\s\S]{0,200}editable: mpPayerEmailEditable\(\)/);
  assert.match(start, /payer_email: payerEmail,/);
  assert.match(start, /payer_is_seller: payerIsSeller\(/);
  assert.doesNotMatch(start, /console\.\w+\([^)]*payerEmail[,)]/);
});

test('the form sends mpEmail only when asked, and both locales have the copy', () => {
  const form = read('src/components/app/billing/pay-form.tsx');
  assert.match(form, /\.\.\.\(askMpEmail \? \{ mpEmail: mpEmail\.trim\(\) \} : \{\}\)/);
  for (const page of [
    'src/app/[locale]/(dashboard)/app/prueba/pago/page.tsx',
    'src/app/[locale]/(dashboard)/app/billing/cambiar/page.tsx',
  ]) {
    // Never under Stripe: that field is about a Mercado Pago account.
    assert.match(read(page), /askMpEmail=\{!stripe && mpPayerEmailEditable\(\)\}/, page);
  }
  for (const lang of ['es', 'en']) {
    const m = JSON.parse(read(`messages/${lang}.json`)).checkout.pay.mpEmail;
    assert.ok(m?.label && m?.hint, lang);
  }
});

test('the form refuses an invalid MP email before tokenising, with its own message', () => {
  const form = read('src/components/app/billing/pay-form.tsx');
  assert.match(form, /if \(askMpEmail && !cleanPayerEmail\(mpEmail\)\) \{\s*setMpEmailBad\(true\);\s*return;/);
  for (const lang of ['es', 'en']) {
    assert.ok(JSON.parse(read(`messages/${lang}.json`)).checkout.pay.mpEmail.invalid, lang);
  }
});
