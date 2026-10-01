// getEntitlements — the ONE server-side answer to "what can this user do?".
//
// Tool cards, tool pages, the launch action and the Clips flow all call this;
// none of them re-derives access from the tier ladder. The decision itself is
// the pure `computeEntitlements` in entitlement-core.ts; this file only
// gathers its inputs.
//
// Takes the session rather than a bare user id: every caller already holds it,
// and it carries the role/tier with the admin allowlist and the plan-lapse
// rule already applied (lib/auth/session.ts). Re-reading the profile here
// would be a second, divergent copy of those rules.

import 'server-only';
import type { SessionUser } from '@/lib/auth/session';
import { listEngines } from '@/lib/data/engines';
import { getTokenBalance } from '@/lib/usage/tokens';
import { freeIncludesClips, proIncludesAllTools } from '@/lib/config/flags';
import { computeEntitlements, type Entitlements } from './entitlement-core';
import { loadBilling } from './subscription-store';

export type { Entitlements, ToolAccess, ToolAccessState, SetupStep } from './entitlement-core';

export async function getEntitlements(session: SessionUser): Promise<Entitlements> {
  const [engines, balance, billing] = await Promise.all([
    listEngines().catch(() => []),
    getTokenBalance(session.user.id).catch(() => null),
    loadBilling(session.user.id).catch((err) => {
      console.error('[entitlements] billing read failed; using the stored tier only', err);
      return null;
    }),
  ]);

  return computeEntitlements({
    userId: session.user.id,
    role: session.role,
    storedTier: session.tier,
    selectedEngineId: session.selectedEngineId,
    clipsTrialStartedAt: session.chalybclipTrialStartedAt,
    bonusCredits: balance && !balance.unlimited ? balance.bonus : 0,
    credits: balance ? { remaining: balance.remaining, unlimited: balance.unlimited } : null,
    engines: engines.map((e) => ({
      id: e.id,
      slug: e.slug,
      status: e.status,
      tierRequired: e.tierRequired,
      ownerUserId: e.ownerUserId,
    })),
    nowMs: Date.now(),
    billing: billing?.primary ?? null,
    trialUsed: billing?.trialUsed ?? false,
    flags: {
      freeIncludesClips: freeIncludesClips(),
      proIncludesAllTools: proIncludesAllTools(),
    },
  });
}
