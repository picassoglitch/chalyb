// Closing an account (Términos y Condiciones §13.1, Paquetes §5.2): pure part.

import test from 'node:test';
import assert from 'node:assert/strict';
import { closurePlan, closureRefusal, closureRequestText } from '@/lib/legal/account-closure-core';

const base = { trialEndsAt: null, nextChargeAt: null, graceEndsAt: null, accessUntil: null };

test('closure: what happens to the plan', () => {
  assert.deepEqual(closurePlan({ ...base, state: 'free' }), { kind: 'none' });
  assert.deepEqual(
    closurePlan({ ...base, state: 'cancelled_active', accessUntil: '2026-11-01T00:00:00Z' }),
    { kind: 'ending', until: '2026-11-01T00:00:00Z' },
  );
  assert.deepEqual(closurePlan({ ...base, state: 'trialing', trialEndsAt: 'T' }), {
    kind: 'charging',
    state: 'trialing',
    until: 'T',
  });
  assert.equal(closurePlan({ ...base, state: 'pro', nextChargeAt: 'N' }).kind, 'charging');
  assert.deepEqual(closurePlan({ ...base, state: 'past_due', graceEndsAt: 'G' }), {
    kind: 'charging',
    state: 'past_due',
    until: 'G',
  });
});

test('closure: fails closed when the credits are unknown or changed', () => {
  const ok = { creditsNow: 120, creditsShown: 120, confirmed: true, openRequest: false };
  assert.equal(closureRefusal(ok), null);
  assert.equal(closureRefusal({ ...ok, creditsNow: null }), 'credits_unknown');
  assert.equal(closureRefusal({ ...ok, creditsShown: 100 }), 'credits_changed');
  assert.equal(closureRefusal({ ...ok, creditsShown: '120' }), 'credits_changed');
  assert.equal(closureRefusal({ ...ok, confirmed: 'true' }), 'not_confirmed');
  assert.equal(closureRefusal({ ...ok, openRequest: true }), 'already_requested');
  // Zero credits still needs the box: the plan part of the warning applies.
  assert.equal(
    closureRefusal({ ...ok, creditsNow: 0, creditsShown: 0, confirmed: false }),
    'not_confirmed',
  );
});

test('closure: the request says what was shown and what happened to the plan', () => {
  const txt = closureRequestText({
    credits: 250,
    plan: { kind: 'charging', state: 'pro', until: null },
    cancelFolio: 'C-ABC123',
  });
  assert.match(txt, /§5\.2\): 250\./);
  assert.match(txt, /folio C-ABC123/);
  assert.match(
    closureRequestText({ credits: 0, plan: { kind: 'none' }, cancelFolio: null }),
    /Sin plan de pago/,
  );
});
