// WS-1 · Mercado Pago integration (B33–B36): one environment per deployment,
// the payer that environment needs, URLs Mercado Pago can actually reach,
// both notification formats, and errors a customer can read.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  getMpEnv,
  isAllowedMpUrl,
  isCardErrorCode,
  mpCredentials,
  mpEnvProblems,
  mpErrorCode,
  mpUrl,
  mpWebhookUrl,
  payerEmailFor,
} from '@/lib/payments/mp-config';
import { checkMpSignature, signatureManifest } from '@/lib/payments/webhook-verify';
import {
  merchantOrderPaymentIds,
  parseMpNotification,
  unsignedAllowed,
} from '@/lib/payments/webhook-notification';
import { manifestId } from '@/lib/payments/subscription-reference';
import { TIER_PRICING } from '@/lib/payments/pricing';

const PK_PROD = 'APP_USR-1a2b3c4d-1111-2222-3333-444455556666';
const TOK_PROD = 'APP_USR-1234567890123456-100125-0123456789abcdef0123456789abcdef-123456789';
const PK_TEST = 'TEST-1a2b3c4d-1111-2222-3333-444455556666';
const TOK_TEST = 'TEST-1234567890123456-100125-0123456789abcdef0123456789abcdef-123456789';

// ── B33 · environment resolver ─────────────────────────────────────────────

test('MP_ENV: Vercel Production defaults to prod, everything else to test, explicit wins', () => {
  assert.equal(getMpEnv({ VERCEL_ENV: 'production' }), 'prod');
  assert.equal(getMpEnv({ VERCEL_ENV: 'preview' }), 'test');
  assert.equal(getMpEnv({}), 'test');
  assert.equal(getMpEnv({ VERCEL_ENV: 'production', MP_ENV: 'test' }), 'test');
  assert.equal(getMpEnv({ VERCEL_ENV: 'preview', MP_ENV: 'PROD' }), 'prod');
  assert.equal(getMpEnv({ VERCEL_ENV: 'preview', MP_ENV: 'staging' }), 'test');
});

test('the token, the card form key and the webhook secret come out as one pair', () => {
  const c = mpCredentials({
    MP_ENV: 'prod',
    MERCADOPAGO_ACCESS_TOKEN: ` ${TOK_PROD} `,
    MERCADOPAGO_PUBLIC_KEY: PK_PROD,
    MERCADOPAGO_WEBHOOK_SECRET: 's',
  });
  assert.deepEqual(c, {
    mpEnv: 'prod',
    accessToken: TOK_PROD,
    publicKey: PK_PROD,
    webhookSecret: 's',
    expectedSellerId: undefined,
  });
});

test('a consistent pair per environment has no problems', () => {
  assert.deepEqual(
    mpEnvProblems({
      MP_ENV: 'prod',
      MERCADOPAGO_ACCESS_TOKEN: TOK_PROD,
      MERCADOPAGO_PUBLIC_KEY: PK_PROD,
    }),
    [],
  );
  assert.deepEqual(
    mpEnvProblems({
      MP_ENV: 'test',
      MERCADOPAGO_ACCESS_TOKEN: TOK_TEST,
      MERCADOPAGO_PUBLIC_KEY: PK_TEST,
      MP_TEST_PAYER_EMAIL: 'test_user_1@testuser.com',
    }),
    [],
  );
  // MP's newer test accounts have APP_USR- credentials of their own.
  assert.deepEqual(
    mpEnvProblems({
      MP_ENV: 'test',
      MERCADOPAGO_ACCESS_TOKEN: TOK_PROD,
      MERCADOPAGO_PUBLIC_KEY: PK_PROD,
      MP_TEST_PAYER_EMAIL: 'test_user_1@testuser.com',
    }),
    [],
  );
});

test('mixed or wrong pairs are problems (and so the checkout fails closed)', () => {
  const mixed = mpEnvProblems({
    MP_ENV: 'prod',
    MERCADOPAGO_ACCESS_TOKEN: TOK_PROD,
    MERCADOPAGO_PUBLIC_KEY: PK_TEST,
  });
  assert.ok(mixed.some((p) => /mismo panel/.test(p)));
  assert.ok(mixed.some((p) => /MP_ENV=prod/.test(p)));
  assert.ok(
    mpEnvProblems({
      MP_ENV: 'prod',
      MERCADOPAGO_ACCESS_TOKEN: TOK_TEST,
      MERCADOPAGO_PUBLIC_KEY: PK_TEST,
    }).length > 0,
    'prod on test keys',
  );
  assert.ok(
    mpEnvProblems({
      MP_ENV: 'test',
      MERCADOPAGO_ACCESS_TOKEN: TOK_TEST,
      MERCADOPAGO_PUBLIC_KEY: PK_TEST,
    }).some((p) => /MP_TEST_PAYER_EMAIL/.test(p)),
    'test without a test buyer',
  );
});

test('payer_email: the test buyer in test, the user in prod, never a test buyer in prod', () => {
  const test_ = { MP_ENV: 'test', MP_TEST_PAYER_EMAIL: 'test_user_9@testuser.com' };
  assert.equal(payerEmailFor('ana@example.com', test_), 'test_user_9@testuser.com');
  assert.equal(payerEmailFor('ana@example.com', { MP_ENV: 'test' }), null);
  const prod = { MP_ENV: 'prod', MP_TEST_PAYER_EMAIL: 'test_user_9@testuser.com' };
  assert.equal(payerEmailFor('ana@example.com', prod), 'ana@example.com');
  assert.equal(payerEmailFor('test_user_9@testuser.com', prod), null);
  assert.equal(payerEmailFor(null, prod), null);
});

/** Every .ts/.tsx file under a directory. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(ts|tsx)$/.test(p) ? [p] : [];
  });
}

test('no Mercado Pago env var is read outside mp-config.ts', () => {
  const offenders = sourceFiles('src')
    .filter((f) => !f.endsWith(join('payments', 'mp-config.ts')))
    .filter((f) =>
      /process\.env(\.|\[['"])(MERCADOPAGO_|MP_)|env\[['"](MERCADOPAGO_|MP_)/.test(
        readFileSync(f, 'utf8'),
      ),
    );
  assert.deepEqual(offenders, []);
});

test('every create call sends the env-resolved payer email and logs the env', () => {
  for (const f of [
    'src/lib/payments/subscription-actions.ts',
    'src/lib/payments/token-checkout-actions.ts',
  ]) {
    const src = readFileSync(f, 'utf8');
    assert.match(src, /mpPayerEmail\(/, f);
    assert.match(src, /logMpCreate\(/, f);
    assert.doesNotMatch(src, /payer_email:\s*(email|session\.user\.email)\b/, f);
    assert.doesNotMatch(src, /email:\s*session\.user\.email/, f);
    assert.doesNotMatch(src, /getAppUrl\(\)\}\/app/, `${f} builds a return URL by hand`);
  }
});

// ── B34 · charged amount = displayed amount ────────────────────────────────

test('the subscription checkout shows and charges the same TIER_PRICING amount', () => {
  // main's only price source: the checkout page prints it, the action sends it.
  const page = readFileSync(
    'src/app/[locale]/(dashboard)/app/subscription/checkout/page.tsx',
    'utf8',
  );
  assert.match(page, /formatMoney\(pricing\.amountCents, pricing\.currency\)/);
  const action = readFileSync('src/lib/payments/subscription-actions.ts', 'utf8');
  assert.match(action, /const pricing = TIER_PRICING\[targetTier\]/);
  assert.equal((action.match(/transaction_amount: pricing\.amountCents \/ 100/g) ?? []).length, 2);
  assert.equal(TIER_PRICING.PRO?.amountCents, 74_900);
  assert.equal(TIER_PRICING.VIP?.amountCents, 249_900);
});

test('no IVA multiplication in the charge path', () => {
  for (const f of [
    'src/lib/payments/subscription-actions.ts',
    'src/lib/payments/token-checkout-actions.ts',
    'src/lib/payments/pricing.ts',
  ]) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /1\.16|\*\s*116\b|ivaRate/i, f);
  }
});

// ── B35 · URLs and notifications ───────────────────────────────────────────

test('in prod every URL handed to Mercado Pago is https://www.chalyb.com/…', () => {
  const prod = { MP_ENV: 'prod' };
  for (const origin of ['https://chalyb.com', 'http://localhost:3000', 'https://x.vercel.app']) {
    const url = mpWebhookUrl(prod, origin);
    assert.equal(url, 'https://www.chalyb.com/api/mp/webhook');
    assert.ok(mpUrl('/app/billing', prod, origin).startsWith('https://www.chalyb.com/'));
  }
  assert.equal(isAllowedMpUrl('https://chalyb.com/app/billing', prod), false);
  assert.equal(isAllowedMpUrl('http://www.chalyb.com/app/billing', prod), false);
  assert.equal(isAllowedMpUrl('https://www.chalyb.com.evil.com/x', prod), false);
  assert.equal(isAllowedMpUrl('https://www.chalyb.com/app/billing', prod), true);
});

test('a test deployment sends the buyer back to itself', () => {
  assert.equal(
    mpUrl('/app/billing', { MP_ENV: 'test' }, 'https://chalyb-git-x.vercel.app/'),
    'https://chalyb-git-x.vercel.app/app/billing',
  );
});

const SECRET = 'whsec';
function sign(manifest: string) {
  return createHmac('sha256', SECRET).update(manifest).digest('hex');
}

test('signature manifest: with and without x-request-id, uppercase alphanumeric id lowercased', () => {
  assert.equal(
    signatureManifest({ dataId: '123', requestId: 'r-1', ts: '9' }),
    'id:123;request-id:r-1;ts:9;',
  );
  assert.equal(signatureManifest({ dataId: '123', requestId: null, ts: '9' }), 'id:123;ts:9;');

  const id = 'AB12CD';
  const v1 = sign(`id:${id.toLowerCase()};ts:9;`);
  assert.deepEqual(
    checkMpSignature({
      secret: SECRET,
      paymentId: manifestId(id),
      requestId: null,
      signatureHeader: `ts=9,v1=${v1}`,
    }),
    { ok: true },
  );
  const withReq = sign('id:ab12cd;request-id:r-1;ts:9;');
  assert.deepEqual(
    checkMpSignature({
      secret: SECRET,
      paymentId: manifestId(id),
      requestId: 'r-1',
      signatureHeader: `ts=9,v1=${withReq}`,
    }),
    { ok: true },
  );
});

test('Webhooks format: JSON body, or the pointer in the query string', () => {
  assert.deepEqual(
    parseMpNotification(
      'https://www.chalyb.com/api/mp/webhook',
      JSON.stringify({ type: 'payment', action: 'payment.created', data: { id: '123' } }),
      'application/json',
    ),
    { format: 'webhook', topic: 'payment', handled: true, dataId: '123' },
  );
  assert.deepEqual(
    parseMpNotification(
      'https://www.chalyb.com/api/mp/webhook?data.id=PRE1&type=subscription_preapproval',
      '',
      null,
    ),
    { format: 'webhook', topic: 'subscription_preapproval', handled: true, dataId: 'PRE1' },
  );
  assert.equal(
    parseMpNotification(
      '/api/mp/webhook',
      JSON.stringify({ type: 'order', data: { id: 'ORD1' } }),
      'application/json',
    ).topic,
    'orders',
  );
});

test('IPN format: merchant_order with an empty body, form body, and resource URL', () => {
  assert.deepEqual(
    parseMpNotification(
      'https://www.chalyb.com/api/mp/webhook?id=182026865254&topic=merchant_order',
      '',
      null,
    ),
    { format: 'ipn', topic: 'merchant_order', handled: true, dataId: '182026865254' },
  );
  assert.deepEqual(
    parseMpNotification(
      '/api/mp/webhook',
      'topic=payment&id=55',
      'application/x-www-form-urlencoded',
    ),
    { format: 'ipn', topic: 'payment', handled: true, dataId: '55' },
  );
  assert.equal(
    parseMpNotification(
      '/api/mp/webhook',
      JSON.stringify({
        resource: 'https://api.mercadolibre.com/merchant_orders/777',
        topic: 'merchant_order',
      }),
      'application/json',
    ).dataId,
    '777',
  );
});

test('unknown topics and junk are unhandled (the route answers 200), never thrown on', () => {
  for (const [url, body] of [
    ['/api/mp/webhook?topic=chargebacks&id=1', ''],
    [
      '/api/mp/webhook',
      JSON.stringify({ type: 'subscription_preapproval_plan', data: { id: 'x' } }),
    ],
    ['/api/mp/webhook', '{not json'],
    ['/api/mp/webhook?topic=constructor&id=1', ''],
    ['/api/mp/webhook', ''],
  ] as const) {
    const n = parseMpNotification(url, body, 'application/json');
    assert.equal(n.handled, false, url + body);
  }
});

test('only IPN may arrive unsigned; Webhooks must carry x-signature', () => {
  assert.equal(
    unsignedAllowed(parseMpNotification('/x?topic=merchant_order&id=1', '', null)),
    true,
  );
  assert.equal(
    unsignedAllowed(
      parseMpNotification('/x', JSON.stringify({ type: 'payment', data: { id: '1' } }), null),
    ),
    false,
  );
});

test('a merchant order yields each of its payments once', () => {
  assert.deepEqual(
    merchantOrderPaymentIds({ payments: [{ id: 1 }, { id: '2' }, { id: 1 }, {}, null] }),
    ['1', '2'],
  );
  assert.deepEqual(merchantOrderPaymentIds({}), []);
});

test('a replayed notification is processed once: ledger writes are keyed on the MP id', () => {
  const route = readFileSync('src/app/api/mp/webhook/route.ts', 'utf8');
  assert.match(route, /onConflict:\s*'mp_payment_id'/);
  assert.match(route, /req\.text\(\)/, 'reads the raw body so an empty IPN body is fine');
  assert.doesNotMatch(route, /req\.json\(\)/);
  assert.match(route, /after\(/, 'acknowledges first when processing runs long');
});

// ── B36 · Mercado Pago errors ──────────────────────────────────────────────

test('MP error codes are extracted for the log and mapped to friendly copy', () => {
  assert.equal(
    mpErrorCode(new Error('CC_VAL_433 Credit card validation has failed')),
    'CC_VAL_433',
  );
  assert.equal(
    mpErrorCode({ message: 'x', cause: [{ code: 205, description: 'bad number' }] }),
    '205',
  );
  assert.equal(
    mpErrorCode({ message: 'rejected: cc_rejected_bad_filled_security_code' }),
    'cc_rejected_bad_filled_security_code',
  );
  assert.equal(mpErrorCode(new Error('timeout')), null);
  assert.equal(isCardErrorCode('CC_VAL_433'), true);
  assert.equal(isCardErrorCode('cc_rejected_other_reason'), true);
  assert.equal(isCardErrorCode('PA_UNAUTHORIZED_RESULT_FROM_POLICIES'), false);
  assert.equal(isCardErrorCode(null), false);
});

test('no raw Mercado Pago error reaches a customer', () => {
  for (const f of [
    'src/lib/payments/subscription-actions.ts',
    'src/lib/payments/token-checkout-actions.ts',
  ]) {
    const src = readFileSync(f, 'utf8');
    assert.doesNotMatch(src, /error:\s*`[^`]*\$\{(detail|describeMpError)/, f);
    assert.doesNotMatch(src, /status_detail\?[^\n]*replace/, f);
  }
});

test('the card form key and the server token come from the same resolver', () => {
  const mp = readFileSync('src/lib/payments/mercadopago.ts', 'utf8');
  assert.match(mp, /getPublicKey\(\)[\s\S]{0,80}mpCredentials\(process\.env\)\.publicKey/);
  assert.match(mp, /getAccessToken\(\)[\s\S]{0,80}mpCredentials\(process\.env\)\.accessToken/);
  assert.match(mp, /getWebhookSecret\(\)[\s\S]{0,80}mpCredentials\(process\.env\)\.webhookSecret/);
});
