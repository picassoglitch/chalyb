// Unit proof of the four QA outcomes our copy already implements.
// NOT a live Mercado Pago adapter. Passing these does not mean a test
// payment succeeded.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  mpQaPersistedState,
  mpQaScenarioFromCardholder,
} from '@/lib/payments/mp-qa-scenarios';

const NOW = new Date('2026-11-07T12:00:00Z');
const NEXT = '2026-12-07T12:00:00Z';

test('this mapper is labelled as a fixture, never a live Mercado Pago adapter', () => {
  const src = readFileSync('src/lib/payments/mp-qa-scenarios.ts', 'utf8');
  assert.match(src, /NOT a live adapter/);
  assert.doesNotMatch(src, /from ['"]mercadopago['"]/);
  assert.doesNotMatch(src, /fetch\(/);
});

test('APRO is approved; OTHE/FUND/CONT are rejected; anything else is unknown', () => {
  assert.equal(mpQaScenarioFromCardholder('APRO'), 'approved');
  assert.equal(mpQaScenarioFromCardholder('othe'), 'rejected');
  assert.equal(mpQaScenarioFromCardholder('FUND'), 'rejected');
  assert.equal(mpQaScenarioFromCardholder('CONT'), 'rejected');
  assert.equal(mpQaScenarioFromCardholder('ANA'), null);
});

test('approved: authorised preapproval activates the plan', () => {
  const r = mpQaPersistedState({
    scenario: 'approved',
    existingLiveSameTier: false,
    mpStatus: 'authorized',
    nextPaymentDate: NEXT,
    now: NOW,
  });
  assert.equal(r.action, 'create');
  assert.equal(r.storedStatus, 'authorized');
  assert.deepEqual(r.entitlement, { kind: 'activate', tier: 'PRO' });
});

test('rejected: no entitlement is granted', () => {
  const r = mpQaPersistedState({
    scenario: 'rejected',
    existingLiveSameTier: false,
    mpStatus: 'rejected',
    nextPaymentDate: null,
    now: NOW,
  });
  assert.equal(r.action, 'none');
  assert.equal(r.storedStatus, 'unknown');
  assert.deepEqual(r.entitlement, { kind: 'none' });
});

test('duplicate: a live authorised row for the same plan creates nothing', () => {
  const r = mpQaPersistedState({
    scenario: 'duplicate',
    existingLiveSameTier: true,
    mpStatus: 'authorized',
    nextPaymentDate: NEXT,
    now: NOW,
  });
  assert.equal(r.action, 'skip_duplicate');
  assert.deepEqual(r.entitlement, { kind: 'activate', tier: 'PRO' });
});

test('canceled: charging stops; the plan runs until the next charge date', () => {
  const r = mpQaPersistedState({
    scenario: 'canceled',
    existingLiveSameTier: false,
    mpStatus: 'canceled',
    nextPaymentDate: NEXT,
    now: NOW,
  });
  assert.equal(r.action, 'create');
  assert.equal(r.storedStatus, 'cancelled');
  assert.equal(r.entitlement.kind, 'end');
  if (r.entitlement.kind === 'end') {
    assert.equal(r.entitlement.endsAt.toISOString(), new Date(NEXT).toISOString());
  }
});
