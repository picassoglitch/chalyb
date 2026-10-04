import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyResendSignature } from '@/lib/email/resend-webhook';
import { statusForStartError } from '@/lib/billing/api';
import {
  paidCheckoutBlockers,
  setLegalPublishStateForTests,
  paidCheckoutEnabled,
  trialFlowEnabled,
  vipYearEnabled,
} from '@/lib/config/flags';

const key = Buffer.from('test-secret-key-0123456789');
const secret = `whsec_${key.toString('base64')}`;
const sign = (id: string, ts: string, body: string) =>
  `v1,${createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64')}`;

test('Resend webhook signature (Svix)', () => {
  const body = '{"type":"email.delivered","data":{"email_id":"m1"}}';
  const ts = '1790000000';
  const base = { secret, id: 'msg_1', timestamp: ts, body, nowS: 1790000010 };
  assert.equal(verifyResendSignature({ ...base, signatureHeader: sign('msg_1', ts, body) }), true);
  assert.equal(
    verifyResendSignature({ ...base, signatureHeader: `v1,bad ${sign('msg_1', ts, body)}` }),
    true,
  );
  assert.equal(
    verifyResendSignature({ ...base, signatureHeader: sign('msg_1', ts, body + ' ') }),
    false,
    'tampered body',
  );
  assert.equal(
    verifyResendSignature({
      ...base,
      nowS: 1790000000 + 600,
      signatureHeader: sign('msg_1', ts, body),
    }),
    false,
    'replayed late',
  );
  assert.equal(
    verifyResendSignature({ ...base, secret: undefined, signatureHeader: sign('msg_1', ts, body) }),
    false,
  );
});

test('API status codes', () => {
  assert.equal(statusForStartError('CONSENT_REQUIRED'), 422);
  assert.equal(statusForStartError('QUEBEC'), 403);
  assert.equal(statusForStartError('CARD_TRIAL_USED'), 409);
});

test('V-1 · paid checkout is refused while anything it depends on is missing; the trial needs it', () => {
  const saved = { ...process.env };
  try {
    process.env.TRIAL_FLOW_ENABLED = 'true';
    delete process.env.PAID_CHECKOUT_ENABLED;
    delete process.env.LEGAL_PUBLISH;
    assert.equal(trialFlowEnabled(), false);
    assert.ok(paidCheckoutBlockers().includes('LEGAL_PUBLISH'));
    process.env.LEGAL_PUBLISH = 'true';
    // WS-12: the flag alone can't publish Law's drafts while brackets remain.
    assert.ok(paidCheckoutBlockers().includes('LEGAL_PUBLISH'));
    setLegalPublishStateForTests({ terminos: { version: '1.0', published: true, placeholders: 0 } });
    for (const k of ['NAME', 'RFC', 'ADDRESS', 'PHONE', 'EMAIL', 'HOURS', 'COMPLAINTS'])
      process.env[`LEGAL_ENTITY_${k}`] = 'x';
    process.env.CONSENT_ENCRYPTION_KEY = 'x';
    process.env.CRON_SECRET = 'x';
    assert.deepEqual(paidCheckoutBlockers(), []);
    // TRIAL_FLOW_ENABLED alone does nothing: paid checkout must be on too.
    assert.equal(paidCheckoutEnabled(), false);
    assert.equal(trialFlowEnabled(), false);
    assert.equal(vipYearEnabled(), false);
    process.env.PAID_CHECKOUT_ENABLED = 'true';
    assert.equal(paidCheckoutEnabled(), true);
    assert.equal(trialFlowEnabled(), true);
    assert.equal(vipYearEnabled(), true);
    process.env.TRIAL_FLOW_ENABLED = 'false';
    assert.equal(trialFlowEnabled(), false, 'paid checkout without the trial');
    assert.equal(paidCheckoutEnabled(), true);
    process.env.VIP_YEAR_ENABLED = 'false';
    assert.equal(vipYearEnabled(), false);
  } finally {
    setLegalPublishStateForTests(null);
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
});
