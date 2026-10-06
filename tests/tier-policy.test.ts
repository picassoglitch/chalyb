// The gate on changeUserTier: paid tiers never come from the user.

import test from 'node:test';
import assert from 'node:assert/strict';
import { decideTierChange } from '@/lib/auth/tier-policy';

test('a user may downgrade themselves to FREE', () => {
  assert.deepEqual(decideTierChange({ newTier: 'FREE', isSelf: true, isAdmin: false }), {
    allow: true,
  });
});

test('a user may NOT hand themselves a paid tier', () => {
  for (const tier of ['PRO', 'VIP'] as const) {
    assert.deepEqual(
      decideTierChange({ newTier: tier, isSelf: true, isAdmin: false }),
      { allow: false, reason: 'payment_required' },
      `self-upgrade to ${tier} must be refused`,
    );
  }
});

test('PARTNER is admin-grant only, with its own reason', () => {
  assert.deepEqual(decideTierChange({ newTier: 'PARTNER', isSelf: true, isAdmin: false }), {
    allow: false,
    reason: 'partner_is_admin_grant',
  });
});

test('a user may not touch anyone else', () => {
  assert.deepEqual(decideTierChange({ newTier: 'FREE', isSelf: false, isAdmin: false }), {
    allow: false,
    reason: 'not_admin',
  });
});

test('an admin may set any real tier, on anyone', () => {
  for (const tier of ['FREE', 'PRO', 'PARTNER', 'VIP'] as const) {
    assert.deepEqual(decideTierChange({ newTier: tier, isSelf: false, isAdmin: true }), {
      allow: true,
    });
  }
});

test('a tier that does not exist is refused even for an admin', () => {
  assert.deepEqual(
    // @ts-expect-error — exactly the hand-rolled call the check is here for
    decideTierChange({ newTier: 'ENTERPRISE', isSelf: false, isAdmin: true }),
    { allow: false, reason: 'unknown_tier' },
  );
});
