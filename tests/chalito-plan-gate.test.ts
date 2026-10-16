import test from 'node:test';
import assert from 'node:assert/strict';
import { chalitoGate, ssoFailureView } from '@/lib/chalito/web/plan-gate';
import es from '../src/lib/chalito/messages/es.json' with { type: 'json' };
import en from '../src/lib/chalito/messages/en.json' with { type: 'json' };

// Chalito is Pro and VIP only (owner decision 2026-10-16).

test('a plan that includes Chalito opens it', () => {
  assert.equal(chalitoGate({ chalito: { state: 'included' } }), 'open');
  assert.equal(chalitoGate({ chalito: { state: 'setup_needed', missing: 'youtube' } }), 'open');
});

test('Gratis (trial offer) gets the locked state', () => {
  assert.equal(chalitoGate({ chalito: { state: 'trial_offer' } }), 'locked');
});

test('an unknown state (engines failed to load) opens; the sign-in check stays the gate', () => {
  assert.equal(chalitoGate({}), 'open');
  assert.equal(chalitoGate(null), 'open');
});

test('a 403 from the hub says Chalito is Pro/VIP and links to the plans', () => {
  assert.deepEqual(ssoFailureView('no_access'), { key: 'noAccess', plansHref: '/app/planes' });
  assert.deepEqual(ssoFailureView('failed'), { key: 'failed', plansHref: null });
  assert.deepEqual(ssoFailureView('rate_limited'), { key: 'rateLimited', plansHref: null });
});

test('the no-access copy exists in es and en', () => {
  for (const m of [es, en]) {
    assert.ok(m.sso.noAccess && m.sso.seePlans);
    assert.match(m.sso.noAccess, /Pro/);
  }
});
