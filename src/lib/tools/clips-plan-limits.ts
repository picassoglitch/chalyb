// The Clips per-video limits of the person's plan, for the upload screen.
// The same TIER_CAPS row the hub's admission checks; admins have none.

import type { SubscriptionTier, UserRole } from '@/lib/auth/session';
import { effectiveTier, isAdminRole, TIER_CAPS } from '@/lib/billing/tiers';

const finite = (n: number): number | null => (Number.isFinite(n) ? n : null);

export function uploadPlanLimits(session: { role: UserRole; tier: SubscriptionTier }): {
  free: boolean;
  maxMinutes: number | null;
  videosPerMonth: number | null;
} {
  if (isAdminRole(session.role)) return { free: false, maxMinutes: null, videosPerMonth: null };
  const tier = effectiveTier(session.role, session.tier);
  const caps = TIER_CAPS[tier];
  return {
    free: tier === 'FREE',
    maxMinutes: finite(caps.maxSourceMinutes),
    videosPerMonth: finite(caps.clipVideosPerMonth),
  };
}
