// The two questions the Mercado Pago webhook has to answer before it grants
// anything: is this really MP, and did they pay the price of the thing they
// are claiming?

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  checkMpSignature,
  checkCharge,
  expectedChargeForPack,
  expectedChargeForTier,
} from '@/lib/payments/webhook-verify';

const SECRET = 'test-webhook-secret';
const PAYMENT_ID = '1234567890';
const REQUEST_ID = 'req-abc';
const TS = '1733520000';

function signedHeader(opts: { secret?: string; paymentId?: string; requestId?: string } = {}) {
  const manifest = `id:${opts.paymentId ?? PAYMENT_ID};request-id:${opts.requestId ?? REQUEST_ID};ts:${TS};`;
  const v1 = createHmac('sha256', opts.secret ?? SECRET).update(manifest).digest('hex');
  return `ts=${TS},v1=${v1}`;
}

test('a correctly signed notification passes', () => {
  assert.deepEqual(
    checkMpSignature({
      secret: SECRET,
      paymentId: PAYMENT_ID,
      requestId: REQUEST_ID,
      signatureHeader: signedHeader(),
    }),
    { ok: true },
  );
});

test('a missing secret fails CLOSED — this was the bug', () => {
  for (const secret of [undefined, null, '', '   ']) {
    assert.deepEqual(
      checkMpSignature({
        secret,
        paymentId: PAYMENT_ID,
        requestId: REQUEST_ID,
        signatureHeader: signedHeader(),
      }),
      { ok: false, reason: 'not_configured' },
      `secret ${JSON.stringify(secret)} must not be treated as verified`,
    );
  }
});

test('a signature from the wrong secret is rejected', () => {
  assert.deepEqual(
    checkMpSignature({
      secret: SECRET,
      paymentId: PAYMENT_ID,
      requestId: REQUEST_ID,
      signatureHeader: signedHeader({ secret: 'not-our-secret' }),
    }),
    { ok: false, reason: 'mismatch' },
  );
});

test('a signature for a different payment id is rejected', () => {
  assert.deepEqual(
    checkMpSignature({
      secret: SECRET,
      paymentId: PAYMENT_ID,
      requestId: REQUEST_ID,
      signatureHeader: signedHeader({ paymentId: '9999' }),
    }),
    { ok: false, reason: 'mismatch' },
  );
});

test('missing or junk headers are rejected, never thrown on', () => {
  const base = { secret: SECRET, paymentId: PAYMENT_ID };
  assert.deepEqual(
    checkMpSignature({ ...base, requestId: null, signatureHeader: signedHeader() }),
    { ok: false, reason: 'missing_headers' },
  );
  assert.deepEqual(checkMpSignature({ ...base, requestId: REQUEST_ID, signatureHeader: null }), {
    ok: false,
    reason: 'missing_headers',
  });
  assert.deepEqual(
    checkMpSignature({ ...base, requestId: REQUEST_ID, signatureHeader: 'garbage' }),
    { ok: false, reason: 'malformed_signature' },
  );
  assert.deepEqual(
    checkMpSignature({ ...base, requestId: REQUEST_ID, signatureHeader: 'ts=1,v1=zzzz' }),
    { ok: false, reason: 'malformed_signature' },
  );
});

test('paying the listed price for a tier passes', () => {
  const expected = expectedChargeForTier('PRO');
  assert.ok(expected);
  assert.deepEqual(checkCharge(expected, { amountMajor: 749, currency: 'MXN' }), { ok: true });
});

test('paying a token pack price against a VIP reference is refused', () => {
  // The attack: buy the $149 pack, then have the notification processed
  // against "<myUserId>|VIP".
  const expected = expectedChargeForTier('VIP');
  assert.ok(expected);
  const result = checkCharge(expected, { amountMajor: 149, currency: 'MXN' });
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, 'amount');
});

test('the right number in the wrong currency is refused', () => {
  const expected = expectedChargeForTier('PRO');
  assert.ok(expected);
  const result = checkCharge(expected, { amountMajor: 749, currency: 'USD' });
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, 'currency');
});

test('a missing amount is refused rather than read as zero-and-fine', () => {
  const expected = expectedChargeForTier('PRO');
  assert.ok(expected);
  assert.equal(checkCharge(expected, { amountMajor: null, currency: 'MXN' }).ok, false);
});

test('token packs price-check the same way', () => {
  const expected = expectedChargeForPack('tokens_500k');
  assert.ok(expected);
  assert.deepEqual(checkCharge(expected, { amountMajor: 599, currency: 'MXN' }), { ok: true });
  assert.equal(checkCharge(expected, { amountMajor: 149, currency: 'MXN' }).ok, false);
});

test('tiers with no price cannot be bought at all', () => {
  // FREE and PARTNER have no TIER_PRICING entry, so there is no amount that
  // makes an approved payment grant them.
  assert.equal(expectedChargeForTier('FREE'), null);
  assert.equal(expectedChargeForTier('PARTNER'), null);
  assert.equal(expectedChargeForPack('tokens_nope'), null);
});
