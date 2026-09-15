// What a user can honestly be told about each engine, derived from TWO facts:
//
//   1. entitlement — what the plan (and the ChalyClip trial / grace window)
//      unlocks for this user; and
//   2. readiness — whether the engine is actually runnable right now: its
//      catalog row says `active` AND it has a real surface to open (an
//      external URL behind a non-placeholder integration). This is the same
//      test getEngineLaunchUrl applies before it will hand out a launch URL,
//      so a card that says "En vivo" is never a button that toasts "todavía
//      no está en línea".
//
// The home page, the engines list, the engine detail page, the help page and
// the sidebar all read from here so their counts and badges agree. Pure: no
// database, no session — pass the rows in and get view-models out, which is
// what makes it unit-testable (tests/readiness.test.ts).

import { TIER_CAPS, CHALYBCLIP_TRIAL_SLUG, engineIsLiveForUser } from './tiers';
import type { SubscriptionTier } from '@/lib/auth/session';
import type { EngineIntegrationMode, EngineStatus } from '@/lib/data/types';

/** The fields readiness needs from an engine row. `Engine` from
 *  lib/data/types satisfies this; so does a narrow admin-client select. */
export interface ReadinessEngine {
  id: string;
  slug: string;
  name: string;
  status: EngineStatus;
  integrationMode: EngineIntegrationMode;
  externalUrl: string | null;
  tierRequired: SubscriptionTier;
  ownerUserId: string | null;
}

/** What the user brings to the table. `tier` is the EFFECTIVE tier
 *  (effectiveTier(role, storedTier)), never the raw stored one. */
export interface Entitlement {
  tier: SubscriptionTier;
  userId: string | null;
  selectedEngineId: string | null;
  /** ChalyClip 7-day trial clock is running (time-based only). */
  trialActive: boolean;
  /** Post-trial grace: FREE user still has bonus tokens. */
  graceActive: boolean;
}

/**
 * One state per engine, the only vocabulary the /app surfaces use:
 *   live         running live for this user (plan + selection/all-access + runnable)
 *   trial        live through the ChalyClip trial / grace window (FREE)
 *   ready        runnable and included in the plan; the user can switch their
 *                live slot to it (Pro / Partner) — the "Activar en vivo" case
 *   simulation   runnable and included, but this plan only runs it in test mode
 *   locked       runnable, but gated behind a higher plan
 *   coming_soon  NOT runnable — upcoming or still being built. Nothing to
 *                activate, whatever the plan says.
 */
export type EngineDisplayState =
  | 'live'
  | 'trial'
  | 'ready'
  | 'simulation'
  | 'locked'
  | 'coming_soon';

export interface EngineView {
  engine: ReadinessEngine;
  state: EngineDisplayState;
  /** active + a real surface to open. */
  isRunnable: boolean;
  /** Plan covers engine.tierRequired (or ChalyClip is unlocked by the trial). */
  meetsTier: boolean;
  isLive: boolean;
  isTrial: boolean;
  isSelected: boolean;
  isOwnedByMe: boolean;
  /** Show the real "Activar en vivo" control: runnable, in plan, not already
   *  live, and the plan has a finite live slot to point at it. */
  canSelectLive: boolean;
}

// PARTNER ranks alongside PRO for tier-required gates.
const TIER_ORDER: Record<SubscriptionTier, number> = { FREE: 0, PRO: 1, PARTNER: 1, VIP: 2 };

/** Runnable = catalog says active AND there is a real surface to open. An
 *  `active` row behind an `internal_placeholder` integration (or with no URL)
 *  is still "en construcción" from the user's point of view. */
export function engineIsRunnable(
  e: Pick<ReadinessEngine, 'status' | 'integrationMode' | 'externalUrl'>,
): boolean {
  return e.status === 'active' && e.integrationMode !== 'internal_placeholder' && !!e.externalUrl;
}

export function meetsTierRequirement(tier: SubscriptionTier, required: SubscriptionTier): boolean {
  return TIER_ORDER[tier] >= TIER_ORDER[required];
}

export function deriveEngineView(engine: ReadinessEngine, ent: Entitlement): EngineView {
  const isRunnable = engineIsRunnable(engine);
  const isOwnedByMe = engine.ownerUserId !== null && engine.ownerUserId === ent.userId;
  const meetsPlan = meetsTierRequirement(ent.tier, engine.tierRequired);
  // The trial only counts when there is something to run; a trial clock
  // ticking against an engine that is down is not an entitlement we show.
  const clipUnlocked =
    isRunnable && (ent.trialActive || ent.graceActive) && engine.slug === CHALYBCLIP_TRIAL_SLUG;
  const meetsTier = meetsPlan || clipUnlocked;
  const isLive =
    isRunnable &&
    engineIsLiveForUser({
      tier: ent.tier,
      engineId: engine.id,
      engineSlug: engine.slug,
      engineStatus: engine.status,
      meetsTier: meetsPlan,
      selectedEngineId: ent.selectedEngineId,
      isOwnedByUser: isOwnedByMe,
      trialActive: clipUnlocked && ent.trialActive,
      graceActive: clipUnlocked && ent.graceActive,
    });
  const isTrial = isLive && clipUnlocked && !meetsPlan;
  const isSelected = engine.id === ent.selectedEngineId;
  const slots = TIER_CAPS[ent.tier].liveEnginesCount;
  const hasFiniteSlot = Number.isFinite(slots) && slots > 0;
  const canSelectLive = isRunnable && meetsPlan && !isLive && hasFiniteSlot;

  let state: EngineDisplayState;
  if (!isRunnable) state = 'coming_soon';
  else if (isTrial) state = 'trial';
  else if (isLive) state = 'live';
  else if (!meetsTier) state = 'locked';
  else if (canSelectLive) state = 'ready';
  else state = 'simulation';

  return {
    engine,
    state,
    isRunnable,
    meetsTier,
    isLive,
    isTrial,
    isSelected,
    isOwnedByMe,
    canSelectLive,
  };
}

export function deriveEngineViews(engines: ReadinessEngine[], ent: Entitlement): EngineView[] {
  return engines.filter((e) => e.status !== 'deprecated').map((e) => deriveEngineView(e, ent));
}

export interface FleetSummary {
  total: number;
  /** live + trial */
  live: number;
  ready: number;
  simulation: number;
  locked: number;
  upcoming: number;
  /** Anything with a real surface, whatever the plan says. */
  runnable: number;
}

export function summarizeFleet(views: EngineView[]): FleetSummary {
  const s: FleetSummary = {
    total: views.length,
    live: 0,
    ready: 0,
    simulation: 0,
    locked: 0,
    upcoming: 0,
    runnable: 0,
  };
  for (const v of views) {
    if (v.isRunnable) s.runnable += 1;
    switch (v.state) {
      case 'live':
      case 'trial':
        s.live += 1;
        break;
      case 'ready':
        s.ready += 1;
        break;
      case 'simulation':
        s.simulation += 1;
        break;
      case 'locked':
        s.locked += 1;
        break;
      case 'coming_soon':
        s.upcoming += 1;
        break;
    }
  }
  return s;
}

/**
 * The ONE primary thing to do next, in priority order:
 *   open_live      something is live → go run it
 *   pick_live      the plan has a live slot and a ready engine to put in it
 *   explore_sim    something is runnable in test mode
 *   view_upcoming  nothing runnable yet → the kit is on its way
 */
export type NextAction =
  | { kind: 'open_live'; engine: { slug: string; name: string } }
  | { kind: 'pick_live'; engine: { slug: string; name: string } }
  | { kind: 'explore_sim'; engine: { slug: string; name: string } }
  | { kind: 'view_upcoming' };

export function deriveNextAction(views: EngineView[]): NextAction {
  const pick = (state: EngineDisplayState | EngineDisplayState[]) => {
    const states = Array.isArray(state) ? state : [state];
    const v = views.find((x) => states.includes(x.state));
    return v ? { slug: v.engine.slug, name: v.engine.name } : null;
  };
  const live = pick(['live', 'trial']);
  if (live) return { kind: 'open_live', engine: live };
  const ready = pick('ready');
  if (ready) return { kind: 'pick_live', engine: ready };
  const sim = pick('simulation');
  if (sim) return { kind: 'explore_sim', engine: sim };
  return { kind: 'view_upcoming' };
}

/**
 * What the plan lets the user run live, phrased against the fleet that is
 * actually there. Never "∞" over an empty fleet: VIP over eight upcoming
 * engines reads "0 en vivo · todo el kit incluido cuando esté listo".
 */
export function liveCapacityLabel(tier: SubscriptionTier, fleet: FleetSummary): string {
  const slots = TIER_CAPS[tier].liveEnginesCount;
  if (slots === 0) return 'solo simulación';
  if (fleet.runnable === 0) {
    return slots === Infinity
      ? 'todo el kit incluido · aún sin herramientas listas'
      : '1 herramienta a elegir · aún sin herramientas listas';
  }
  if (slots === Infinity)
    return `todo el kit · ${fleet.runnable} lista${fleet.runnable === 1 ? '' : 's'}`;
  return `1 a elegir entre ${fleet.runnable} lista${fleet.runnable === 1 ? '' : 's'}`;
}
