import { describe, expect, it } from 'vitest';
import { decideTierChange, PAID_TIERS } from './tier-change-policy';
import type { SubscriptionTier } from '@/lib/auth/session';

// The regression these guard: changeUserTier used to write whatever tier the
// browser asked for and merely SET a `paymentRequired: true` flag on the way
// out, so calling the server action directly handed you VIP for free.

describe('decideTierChange', () => {
  describe('a non-admin acting on their own row', () => {
    it.each(PAID_TIERS)('refuses a self-upgrade to %s', (tier) => {
      const decision = decideTierChange({ isSelf: true, isAdmin: false, newTier: tier });
      expect(decision.allowed).toBe(false);
      expect(decision.allowed === false && decision.reason).toBe('payment_required');
    });

    it('refuses PARTNER, which is granted rather than sold', () => {
      const decision = decideTierChange({ isSelf: true, isAdmin: false, newTier: 'PARTNER' });
      expect(decision.allowed).toBe(false);
      expect(decision.allowed === false && decision.reason).toBe('partner_admin_only');
    });

    it('allows a downgrade to FREE', () => {
      const decision = decideTierChange({ isSelf: true, isAdmin: false, newTier: 'FREE' });
      expect(decision).toEqual({ allowed: true, kind: 'self_downgrade' });
    });
  });

  describe('a non-admin acting on someone else', () => {
    it.each<SubscriptionTier>(['FREE', 'PRO', 'PARTNER', 'VIP'])('refuses %s outright', (tier) => {
      const decision = decideTierChange({ isSelf: false, isAdmin: false, newTier: tier });
      expect(decision.allowed).toBe(false);
      expect(decision.allowed === false && decision.reason).toBe('not_self_not_admin');
    });
  });

  describe('an admin', () => {
    it.each<SubscriptionTier>(['FREE', 'PRO', 'PARTNER', 'VIP'])(
      'may grant %s to someone else',
      (tier) => {
        const decision = decideTierChange({ isSelf: false, isAdmin: true, newTier: tier });
        expect(decision).toEqual({ allowed: true, kind: 'admin_grant' });
      },
    );

    it('may also change their own tier', () => {
      const decision = decideTierChange({ isSelf: true, isAdmin: true, newTier: 'VIP' });
      expect(decision).toEqual({ allowed: true, kind: 'admin_grant' });
    });
  });

  it('rejects a tier that does not exist, even from an admin', () => {
    const decision = decideTierChange({
      isSelf: false,
      isAdmin: true,
      newTier: 'ENTERPRISE' as SubscriptionTier,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.reason).toBe('invalid_tier');
  });
});
