// The access decision, as a pure function (BUILD-SPEC §4.1 B1).
//
// Every customer surface — tool cards, tool pages, the launch action, the
// Clips flow — asks ONE question: "what can this user do with each tool?".
// Before this module, the home page, the tools list and the tool page each
// re-derived the answer from the tier ladder, and they disagreed (a Free user
// saw "Disponible" on a card and "Requiere Pro" one click later).
//
// This file holds the decision itself and has no I/O, so it is unit-tested
// directly. `entitlement.ts` gathers the inputs from the database and calls it.
// P0 delegates to the existing ladder in tiers.ts (including the legacy 7-day
// Clips trial and its grace window); P2 extends the same shape with the new
// trial and billing fields.

import type { SubscriptionTier, UserRole } from '@/lib/auth/session';
import {
  CHALYBCLIP_TRIAL_SLUG,
  chalybclipTrialDaysLeft,
  effectiveTier,
  engineIsLiveForUser,
  isAdminRole,
  isChalybclipGraceActive,
  isChalybclipTrialActive,
} from './tiers';
import { HIDDEN_FROM_CUSTOMERS } from '@/lib/engines/display-names';
import type { BillingState } from './billing-state';

/** A step the user has to finish before a tool can run (BUILD-SPEC B2). Each
 *  one maps to exactly one button that resolves it. */
export type SetupStep = 'youtube' | 'twitch' | 'obs' | 'whatsapp' | 'exchange';

export type ToolAccess =
  | { state: 'included' }
  | { state: 'trial_offer' }
  | { state: 'setup_needed'; missing: SetupStep };

export type ToolAccessState = ToolAccess['state'];

export interface EntitlementEngine {
  id: string;
  slug: string;
  status: string;
  tierRequired: SubscriptionTier;
  ownerUserId: string | null;
}

export interface EntitlementInput {
  userId: string;
  role: UserRole;
  storedTier: SubscriptionTier;
  selectedEngineId: string | null;
  /** profiles.chalybclip_trial_started_at — the legacy 7-day Clips trial. */
  clipsTrialStartedAt: string | null;
  /** Persistent (non-monthly) credit balance; drives the legacy grace window. */
  bonusCredits: number;
  credits: { remaining: number; unlimited: boolean } | null;
  engines: EntitlementEngine[];
  nowMs: number;
  flags: { freeIncludesClips: boolean; proIncludesAllTools: boolean };
  /** P2: the subscription state, when known. Its grant counts alongside the
   *  stored tier (a cancelled VIP keeps VIP until its period ends even after
   *  a scheduled Pro downgrade was authorised). */
  billing?: BillingState | null;
  /** P2: whether the account already used its free Pro month. */
  trialUsed?: boolean;
}

export interface Entitlements {
  /** Effective plan: admins count as VIP. */
  plan: SubscriptionTier;
  isAdmin: boolean;
  /** The legacy Clips trial, while it or its grace window is running. P2
   *  replaces this with the Pro trial. */
  trial: { kind: 'clips_legacy'; daysLeft: number; grace: boolean } | null;
  /** Whether the user already spent their Pro trial — the offer then reads
   *  "Volver a Pro". */
  trialUsed: boolean;
  /** Subscription state (P2), or null when unknown. */
  billing: BillingState | null;
  /** One entry per tool the customer may see. A tool that is not active (or
   *  is hidden, Q32) has NO entry: it is not shown anywhere and its page
   *  redirects. */
  tools: Record<string, ToolAccess>;
  credits: { remaining: number; unlimited: boolean } | null;
}

const TIER_RANK: Record<SubscriptionTier, number> = { FREE: 0, PRO: 1, PARTNER: 1, VIP: 2 };

export function meetsTierRequirement(plan: SubscriptionTier, required: SubscriptionTier): boolean {
  return TIER_RANK[plan] >= TIER_RANK[required];
}

/** Whether a tool can appear in customer UI at all. */
export function isCustomerVisible(engine: Pick<EntitlementEngine, 'slug' | 'status'>): boolean {
  return engine.status === 'active' && !HIDDEN_FROM_CUSTOMERS.has(engine.slug);
}

const GRANT_RANK: Record<SubscriptionTier, number> = { FREE: 0, PRO: 1, PARTNER: 1, VIP: 2 };

export function computeEntitlements(input: EntitlementInput): Entitlements {
  const stored = effectiveTier(input.role, input.storedTier);
  const granted = input.billing?.grantsTier ?? 'FREE';
  const plan = GRANT_RANK[granted] > GRANT_RANK[stored] ? granted : stored;
  const isAdmin = isAdminRole(input.role);
  const trialActive = isChalybclipTrialActive(input.clipsTrialStartedAt, input.nowMs);
  const graceActive =
    plan === 'FREE' &&
    isChalybclipGraceActive(input.clipsTrialStartedAt, input.nowMs, input.bonusCredits);

  const tools: Record<string, ToolAccess> = {};
  for (const engine of input.engines) {
    if (!isCustomerVisible(engine)) continue;
    tools[engine.slug] = toolAccessFor(engine, input, plan, trialActive, graceActive);
  }

  return {
    plan,
    isAdmin,
    trial:
      trialActive || graceActive
        ? {
            kind: 'clips_legacy',
            daysLeft: chalybclipTrialDaysLeft(input.clipsTrialStartedAt, input.nowMs),
            grace: graceActive,
          }
        : null,
    trialUsed: input.trialUsed ?? false,
    billing: input.billing ?? null,
    tools,
    credits: input.credits,
  };
}

function toolAccessFor(
  engine: EntitlementEngine,
  input: EntitlementInput,
  plan: SubscriptionTier,
  trialActive: boolean,
  graceActive: boolean,
): ToolAccess {
  // Q19: every plan, Free included, can make clips.
  if (input.flags.freeIncludesClips && engine.slug === CHALYBCLIP_TRIAL_SLUG) {
    return { state: 'included' };
  }

  // Q7: Pro sells every tool once P2 turns this on.
  if (input.flags.proIncludesAllTools && plan !== 'FREE') {
    return { state: 'included' };
  }

  const live = engineIsLiveForUser({
    tier: plan,
    engineId: engine.id,
    engineSlug: engine.slug,
    engineStatus: engine.status,
    meetsTier: meetsTierRequirement(plan, engine.tierRequired),
    selectedEngineId: input.selectedEngineId,
    isOwnedByUser: engine.ownerUserId !== null && engine.ownerUserId === input.userId,
    trialActive,
    graceActive,
  });
  return live ? { state: 'included' } : { state: 'trial_offer' };
}
