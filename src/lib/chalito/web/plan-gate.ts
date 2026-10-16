// Chalito is part of Pro and VIP only (owner decision 2026-10-16). The layout opens Chalito only
// when the plan includes it; otherwise it shows the shared "viene en Pro" state, with the trial
// or the plans, instead of a sign-in that would fail with a 403.
import type { ToolAccess } from '@/lib/billing/entitlement-core';

export type ChalitoGate = 'open' | 'locked';

/** `tools` is Entitlements.tools. Only a definite "not in your plan" (trial_offer) locks. A
 *  missing entry (e.g. the engines list failed to load) opens, and the sign-in's own entitlement
 *  check stays the real gate, so a read error never locks out a Pro or VIP user. */
export const chalitoGate = (tools: Record<string, ToolAccess> | null | undefined): ChalitoGate =>
  tools?.chalito?.state === 'trial_offer' ? 'locked' : 'open';

export type SsoFailure = 'no_access' | 'failed' | 'rate_limited';

/** What the sign-in bridge shows when the hub refuses: a 403 means the plan doesn't include
 *  Chalito, so it says so and links to the plans, never the generic "try again" text. */
export const ssoFailureView = (
  failure: SsoFailure,
): { key: 'noAccess' | 'failed' | 'rateLimited'; plansHref: string | null } =>
  failure === 'no_access'
    ? { key: 'noAccess', plansHref: '/app/planes' }
    : { key: failure === 'rate_limited' ? 'rateLimited' : 'failed', plansHref: null };

/** HTTP status for a refused launch at /api/tools/chalito/sso. Only "this plan doesn't include
 *  Chalito" (NEEDS_PLAN) is a 403, which HubBridge shows as "Chalito es parte de Pro y VIP";
 *  provisioning errors, an unavailable tool or anything else is a 503 with the generic retry, so
 *  a paying user never sees "Ver planes" for a server problem. */
export const ssoFailureStatus = (code: string): number => (code === 'NEEDS_PLAN' ? 403 : 503);
