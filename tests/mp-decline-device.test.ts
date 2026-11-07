// Owner trial on 2026-11-07: MP answered cc_rejected_high_risk and the form
// blamed the bank. Device ID header + per-reason copy.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DECLINE_REASONS,
  asDeclineReason,
  declineReasonOf,
  rejectionDetailOf,
  type DeclineReason,
} from '@/lib/payments/card-decline';
import {
  cleanDeviceSessionId,
  deviceSessionAudit,
  meliSessionOptions,
} from '@/lib/payments/device-session';

const TOK_TEST = 'TEST-1234567890123456-100125-0123456789abcdef0123456789abcdef-123456789';
// Real shape, measured on www.chalyb.com 2026-11-07: "armor." + 225 hex = 231 chars.
const DEVICE = `armor.${'4f1c9b2e7d'.repeat(22)}a6c3b`;
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

interface Captured {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

/** Runs `fn` with fetch answering `status`/`json`, through the real SDK. */
async function withFetch<T>(
  status: number,
  json: unknown,
  fn: () => Promise<T>,
): Promise<{ calls: Captured[]; result?: T; error?: unknown }> {
  const calls: Captured[] = [];
  const real = globalThis.fetch;
  const saved = { token: process.env.MERCADOPAGO_ACCESS_TOKEN, env: process.env.MP_ENV };
  process.env.MERCADOPAGO_ACCESS_TOKEN = TOK_TEST;
  process.env.MP_ENV = 'test';
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({
      url: String(url),
      headers: Object.fromEntries(
        Object.entries((init.headers ?? {}) as Record<string, string>).map(([k, v]) => [
          k.toLowerCase(),
          v,
        ]),
      ),
      body: JSON.parse(String(init.body ?? '{}')),
    });
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
    for (const [k, v] of [
      ['MERCADOPAGO_ACCESS_TOKEN', saved.token],
      ['MP_ENV', saved.env],
    ] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

// ── status_detail → reason ────────────────────────────────────────────────

test('cc_rejected_high_risk is a risk decline, never a bank one', () => {
  assert.equal(declineReasonOf('cc_rejected_high_risk'), 'risk');
  assert.equal(declineReasonOf('cc_rejected_blacklist'), 'risk');
  assert.equal(declineReasonOf('CC_REJECTED_HIGH_RISK'), 'risk');
});

test('bank declines keep their own reasons', () => {
  assert.equal(declineReasonOf('cc_rejected_insufficient_amount'), 'funds');
  assert.equal(declineReasonOf('cc_rejected_call_for_authorize'), 'authorize');
  assert.equal(declineReasonOf('cc_rejected_bad_filled_security_code'), 'card_data');
  assert.equal(declineReasonOf('cc_rejected_bad_filled_date'), 'card_data');
  assert.equal(declineReasonOf('cc_rejected_card_disabled'), 'disabled');
  assert.equal(declineReasonOf('cc_rejected_max_attempts'), 'max_attempts');
  assert.equal(declineReasonOf('cc_rejected_duplicated_payment'), 'duplicated');
  assert.equal(declineReasonOf('cc_rejected_other_reason'), 'bank');
  assert.equal(declineReasonOf('cc_rejected_invalid_installments'), 'bank');
});

test('a generic or missing code is unknown (neutral copy, no blame)', () => {
  assert.equal(declineReasonOf('CC_VAL_433'), 'unknown');
  assert.equal(declineReasonOf(null), 'unknown');
  assert.equal(declineReasonOf(''), 'unknown');
  assert.equal(asDeclineReason('risk'), 'risk');
  assert.equal(asDeclineReason('<script>'), 'unknown');
  assert.equal(asDeclineReason(undefined), 'unknown');
});

test('the detail is found in the error the real SDK throws on a 400', async () => {
  const { getMercadoPagoIsolated } = await import('@/lib/payments/mercadopago');
  const bodies = [
    { message: 'cc_rejected_high_risk', error: 'bad_request', status: 400, cause: [] },
    {
      message: 'CC_VAL_433 Credit card validation has failed',
      error: 'bad_request',
      status: 400,
      cause: [{ code: 'CC_VAL_433', description: 'status_detail: cc_rejected_high_risk' }],
    },
  ];
  for (const body of bodies) {
    const { error } = await withFetch(400, body, () =>
      getMercadoPagoIsolated().preapproval.create({ body: { reason: 'x' } }),
    );
    assert.ok(error, 'the SDK throws on 400');
    assert.equal(rejectionDetailOf(error), 'cc_rejected_high_risk');
    assert.equal(declineReasonOf(rejectionDetailOf(error)), 'risk');
  }
  const { error } = await withFetch(
    400,
    { message: 'CC_VAL_433 Credit card validation has failed', status: 400, cause: [] },
    () => getMercadoPagoIsolated().preapproval.create({ body: { reason: 'x' } }),
  );
  assert.equal(rejectionDetailOf(error), null);
  assert.equal(rejectionDetailOf(null), null);
  assert.equal(rejectionDetailOf('boom'), null);
});

// ── Device ID ─────────────────────────────────────────────────────────────

test('device session ids: only MP-shaped strings pass', () => {
  assert.equal(cleanDeviceSessionId(DEVICE), DEVICE);
  assert.equal(cleanDeviceSessionId(`  ${DEVICE} `), DEVICE);
  assert.equal(cleanDeviceSessionId(''), null);
  assert.equal(cleanDeviceSessionId('short'), null);
  assert.equal(cleanDeviceSessionId('a b c d e f g h'), null);
  assert.equal(DEVICE.length, 231);
  assert.equal(cleanDeviceSessionId('x'.repeat(512)), 'x'.repeat(512));
  assert.equal(cleanDeviceSessionId('x'.repeat(513)), null);
  assert.equal(cleanDeviceSessionId('abc\r\nX-Evil: 1'), null);
  assert.equal(cleanDeviceSessionId(42), null);
  assert.deepEqual(meliSessionOptions(null), {});
  assert.deepEqual(meliSessionOptions(DEVICE), { meliSessionId: DEVICE });
});

test('the preapproval request carries X-meli-session-id, and only on that call', async () => {
  const { getMercadoPagoIsolated } = await import('@/lib/payments/mercadopago');
  const { calls } = await withFetch(201, { id: 'pre_1', status: 'authorized' }, async () => {
    const clients = getMercadoPagoIsolated();
    await clients.preapproval.create({
      body: {
        reason: 'Chalyb Pro anual',
        payer_email: 'buyer@example.com',
        card_token_id: 'tok_1',
        auto_recurring: { frequency: 12, frequency_type: 'months', currency_id: 'MXN' },
        status: 'authorized',
      },
      requestOptions: meliSessionOptions(DEVICE),
    });
    // A later call on a fresh isolated client must not inherit it.
    await getMercadoPagoIsolated().preapproval.create({ body: { reason: 'other' } });
  });
  assert.equal(calls.length, 2);
  assert.match(calls[0]!.url, /\/preapproval\/?$/);
  assert.equal(calls[0]!.headers['x-meli-session-id'], DEVICE);
  assert.equal(calls[0]!.body.card_token_id, 'tok_1');
  assert.equal(calls[1]!.headers['x-meli-session-id'], undefined);
});

test('no device id → no header (never an empty one)', async () => {
  const { getMercadoPagoIsolated } = await import('@/lib/payments/mercadopago');
  const { calls } = await withFetch(201, { id: 'pre_2', status: 'authorized' }, () =>
    getMercadoPagoIsolated().preapproval.create({
      body: { reason: 'x' },
      requestOptions: meliSessionOptions('bad id'),
    }),
  );
  assert.equal(calls[0]!.headers['x-meli-session-id'], undefined);
});

test('the audit says whether an id came and survived, never the id itself', () => {
  assert.deepEqual(deviceSessionAudit(DEVICE), { sent: true, kept: true, length: 231 });
  assert.deepEqual(deviceSessionAudit(undefined), { sent: false, kept: false, length: 0 });
  assert.deepEqual(deviceSessionAudit('bad id'), { sent: true, kept: false, length: 6 });
  assert.ok(!JSON.stringify(deviceSessionAudit(DEVICE)).includes('armor'));
});

test('trial and change routes log the device-session audit before calling MP', () => {
  for (const [p, call] of [
    ['src/app/api/billing/trial/route.ts', 'startSubscription'],
    ['src/app/api/billing/change/route.ts', 'changePlan'],
  ] as const) {
    const src = read(p);
    const log = src.indexOf('deviceSessionAudit(body.deviceSessionId)');
    assert.ok(log > 0 && log < src.indexOf(`await ${call}(`), p);
  }
});

// ── Wiring (the server paths are Supabase-bound; their source is pinned) ────

test('startSubscription sends the device id and answers the decline reason', () => {
  const src = read('src/lib/billing/start-subscription.ts');
  assert.match(src, /getMercadoPagoIsolated\(\)[\s\S]{0,80}preapproval\.create\(/);
  assert.match(src, /requestOptions: meliSessionOptions\(input\.deviceSessionId\)/);
  assert.match(src, /code: 'DECLINED', decline: declineReasonOf\(detail\)/);
  assert.match(src, /const detail = rejectionDetailOf\(err\)/);
});

test('trial, change and card routes forward the device id; card maps the decline', () => {
  for (const p of ['src/app/api/billing/trial/route.ts', 'src/app/api/billing/change/route.ts']) {
    assert.match(read(p), /deviceSessionId: cleanDeviceSessionId\(body\.deviceSessionId\)/, p);
  }
  assert.match(read('src/lib/billing/billing-actions.ts'), /deviceSessionId: input\.deviceSessionId/);
  const card = read('src/app/api/billing/card/route.ts');
  assert.match(card, /requestOptions: meliSessionOptions\(body\.deviceSessionId\)/);
  assert.match(card, /decline: declineReasonOf\(detail\)/);
  const pack = read('src/lib/payments/token-checkout-actions.ts');
  assert.match(pack, /\.\.\.meliSessionOptions\(input\.deviceSessionId\)/);
});

test('the card form loads security.js after ready and hands the id up on submit', () => {
  const html = read('public/mp/card-brick.html');
  assert.match(html, /https:\/\/www\.mercadopago\.com\/v2\/security\.js/);
  assert.match(html, /setAttribute\('view', 'checkout'\)/);
  assert.match(html, /ready = true;\s*loadDeviceId\(\);/);
  assert.equal((html.match(/withDeviceId\(function \(device\) \{\s*send\('submit'/g) ?? []).length, 2);
  assert.equal((html.match(/deviceSessionId: device\b/g) ?? []).length, 2);
  assert.doesNotMatch(html, /deviceSessionId: deviceId\(\)/);
  // A second page-button click during the wait is ignored until the result comes back.
  assert.match(html, /function requestSubmit\(\) \{\s*if \(requesting\) return;/);
  assert.match(html, /chalyb-mp:submit-result'\) \{[\s\S]{0,120}requesting = false;/);
  const brick = read('src/components/payments/mp-card-brick.tsx');
  assert.match(brick, /deviceSessionId,\n\s*\}\);/);
  const form = read('src/components/app/billing/pay-form.tsx');
  assert.match(form, /deviceSessionId: card\.deviceSessionId/);
  assert.match(form, /t\(`decline\.\$\{asDeclineReason\(body\.decline\)\}`\)/);
  assert.match(read('src/components/workspace/pack-checkout.tsx'), /deviceSessionId: card\.deviceSessionId/);
});

test('every decline reason has copy in es and en; risk never blames the bank', () => {
  for (const lang of ['es', 'en']) {
    const m = JSON.parse(read(`messages/${lang}.json`));
    const decline = m.checkout.pay.decline as Record<DeclineReason, string>;
    assert.deepEqual(Object.keys(decline).sort(), [...DECLINE_REASONS].sort(), lang);
    assert.equal(m.checkout.pay.declined, undefined, `${lang}: old bank-only key is gone`);
    assert.doesNotMatch(decline.risk, /banco|bank/i, lang);
    assert.doesNotMatch(decline.unknown, /banco|bank/i, lang);
    assert.match(decline.risk, /Mercado Pago/);
    assert.match(decline.bank, /banco|bank/i);
  }
});

test('legacy monthly checkout (/app/subscription/checkout) sends the device id and maps declines', () => {
  const src = read('src/lib/payments/subscription-actions.ts');
  const authorize = src.slice(
    src.indexOf('export async function authorizeTierSubscription'),
    src.indexOf('export interface HostedSubscriptionResult'),
  );
  assert.match(authorize, /getMercadoPagoIsolated\(\)[\s\S]{0,80}preapproval\.create\(/);
  assert.doesNotMatch(authorize, /getMercadoPago\(\)/);
  assert.match(authorize, /requestOptions: meliSessionOptions\(input\.deviceSessionId\)/);
  assert.match(authorize, /const detail = rejectionDetailOf\(err\)/);
  assert.match(authorize, /decline: declineReasonOf\(detail\)/);
  const page = read('src/components/workspace/subscription-checkout.tsx');
  assert.match(page, /deviceSessionId: card\.deviceSessionId/);
  assert.match(page, /tPay\(`decline\.\$\{asDeclineReason\(res\.decline\)\}`\)/);
});

test('a high-risk rejection on the legacy path lands on the risk copy', async () => {
  const { getMercadoPagoIsolated } = await import('@/lib/payments/mercadopago');
  const { calls, error } = await withFetch(
    400,
    { message: 'cc_rejected_high_risk', error: 'bad_request', status: 400, cause: [] },
    () =>
      getMercadoPagoIsolated().preapproval.create({
        body: { reason: 'Chalyb Pro', card_token_id: 'tok_legacy', status: 'authorized' },
        requestOptions: meliSessionOptions(DEVICE),
      }),
  );
  assert.equal(calls[0]!.headers['x-meli-session-id'], DEVICE);
  assert.equal(declineReasonOf(rejectionDetailOf(error)), 'risk');
});
