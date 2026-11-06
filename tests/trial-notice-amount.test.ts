// Trial notices print what the subscription will actually charge, not
// today's catalog price (2026-11-06 price change).
import test from 'node:test';
import assert from 'node:assert/strict';
import { trialNoticeVars } from '../src/lib/billing/notices';

const base = {
  nombre: 'Ana',
  startedAt: '2026-11-01T18:00:00Z',
  trialEndsAt: '2026-11-08T18:00:00Z',
  chargeAt: '2026-11-08T18:00:00Z',
  last4: '4821',
  consentId: null,
  appUrl: 'https://www.chalyb.com',
  now: new Date('2026-11-06T18:00:00Z'),
};

test('a trial started at the old price is told the old amount', () => {
  const v = trialNoticeVars({ ...base, planKey: 'pro_month', amountCents: 99_700 });
  assert.equal(v.monto, '$997');
  assert.equal(v.renovacion, 'cada mes ($997 MXN)');
  const y = trialNoticeVars({ ...base, planKey: 'vip_year', amountCents: 3_632_500 });
  assert.equal(y.monto, '$36,325');
});

test('no stored amount falls back to today’s price', () => {
  assert.equal(trialNoticeVars({ ...base, planKey: 'pro_month' }).monto, '$1,099');
  assert.equal(trialNoticeVars({ ...base, planKey: 'pro_year', amountCents: null }).monto, '$10,990');
  assert.equal(trialNoticeVars({ ...base, planKey: 'vip_month', amountCents: 0 }).monto, '$4,199');
});
