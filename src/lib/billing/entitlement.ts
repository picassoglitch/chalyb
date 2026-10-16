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
import { cache } from 'react';
import type { SessionUser } from '@/lib/auth/session';
import { listEngines } from '@/lib/data/engines';
import { getTokenBalance } from '@/lib/usage/tokens';
import { freeIncludesClips, proIncludesAllTools } from '@/lib/config/flags';
import { computeEntitlements, type Entitlements } from './entitlement-core';
import { loadBilling } from './subscription-store';

export type { Entitlements, ToolAccess, ToolAccessState, SetupStep } from './entitlement-core';

/** Start the entitlement reads that only need the user id (all memoized per
 *  request) while the caller is still reading the profile row: by the time
 *  getEntitlements runs they are in flight or done, which saves one serial
 *  round of database calls per screen. Errors are left to getEntitlements. */
export function warmEntitlements(userId: string): void {
  void listEngines().catch(() => {});
  void getTokenBalance(userId).catch(() => {});
  void loadBilling(userId).catch(() => {});
}

// Memoized per request (React cache) by session: getSessionUser is memoized
// too, so the layout, the tool gate and a screen that ask again share one
// answer.
export const getEntitlements = cache(async (session: SessionUser): Promise<Entitlements> => {
  const [engines, balance, billing] = await Promise.all([
    listEngines().catch(() => []),
    getTokenBalance(session.user.id).catch(() => null),
    loadBilling(session.user.id).catch((err) => {
      console.error('[entitlements] billing read failed; using the stored tier only', err);
      return null;
    }),
  ]);

  // WS-8 · after a bad-faith chargeback, and only with the measures flag on:
  // paid features off (Términos §10.6). Content download is not gated here
  // and always stays.
  const suspended = billing?.restriction.paidSuspended ?? false;
  return computeEntitlements({
    userId: session.user.id,
    role: session.role,
    storedTier: suspended ? 'FREE' : session.tier,
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
    billing: suspended ? null : (billing?.primary ?? null),
    trialUsed: billing?.trialUsed ?? false,
    flags: {
      freeIncludesClips: freeIncludesClips(),
      proIncludesAllTools: proIncludesAllTools(),
    },
  });
});
