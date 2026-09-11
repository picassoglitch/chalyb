// Shared types + structural config for the "Mis engines" hub.
//
// The DB (lib/data/engines.ts) owns each engine's identity, status, tier gate,
// and ownership. Marketing copy (tagline + bullets) is localized in
// messages/*.json under the `engines.marketing*` keys and resolved server-side
// in the page, then baked into each EngineVM as plain strings.
//
// This module is framework-agnostic (no 'use client'): the server page builds
// EngineVM[] and the client explorer renders them, both importing from here.

/** Coarse live/lock/lifecycle state — drives the status badge + filter bucket.
 *  Exactly one per engine. */
export type EngineLiveState =
  | 'live' // running live for this user (meets tier, selected / all-access)
  | 'trial' // live via the ChalybClip trial/grace window (FREE user)
  | 'simulation' // active + available, but running in simulation (not live)
  | 'locked' // active but gated behind a higher plan
  | 'coming_soon'; // not launched yet

/** The visual treatment a card renders with. Three distinct looks so the
 *  states are tellable apart at a glance (spec: available / locked / soon).
 *  `featured` is the dominant ChalybClip card inside the available section. */
export type EngineCardVariant = 'featured' | 'available' | 'locked' | 'soon';

/** Which actionability section an engine belongs to on the default (grouped)
 *  view. */
export type EngineSection = 'available' | 'pro' | 'soon';

/** The filter tabs above the grid. `all` always matches. */
export type EngineFilterKey = 'all' | 'live' | 'simulation' | 'coming_soon' | 'locked';

/** Tab order. Labels are localized in the component via the `engines.filters`
 *  message keys (keyed by these same strings). */
export const ENGINE_FILTER_KEYS: EngineFilterKey[] = [
  'all',
  'live',
  'simulation',
  'coming_soon',
  'locked',
];

/** Which filter buckets an engine belongs to (besides 'all'). */
export function filterKeysFor(state: EngineLiveState): EngineFilterKey[] {
  switch (state) {
    case 'live':
    case 'trial':
      return ['all', 'live'];
    case 'simulation':
      return ['all', 'simulation'];
    case 'locked':
      return ['all', 'locked'];
    case 'coming_soon':
      return ['all', 'coming_soon'];
  }
}

/** Actionability section for the grouped (default) layout. */
export function sectionFor(state: EngineLiveState): EngineSection {
  if (state === 'coming_soon') return 'soon';
  if (state === 'locked') return 'pro';
  return 'available'; // live | trial | simulation
}

/** Card variant from state + featured flag. */
export function variantFor(state: EngineLiveState, featured: boolean): EngineCardVariant {
  if (state === 'coming_soon') return 'soon';
  if (state === 'locked') return 'locked';
  if (featured) return 'featured';
  return 'available';
}

/** Serializable view-model the server hands to the client explorer. No
 *  functions, no Date — safe to cross the RSC boundary. Note: NO infra
 *  metadata (env / region) — that's dev-only and never shown to users. */
export interface EngineVM {
  id: string;
  slug: string;
  name: string;
  icon: string;
  type: string;
  categoryLabel: string;
  state: EngineLiveState;
  filterKeys: EngineFilterKey[];
  /** Marketing one-liner + up to 3 short bullets (localized server-side). */
  tagline: string;
  bullets: string[];
  /** Tier gate, pretty label ('Pro' | 'VIP' | 'Partner') or null for FREE. */
  requiresPlanLabel: string | null;
  meetsTier: boolean;
  /** Owner attribution. */
  isPlatformOwned: boolean;
  isOwnedByMe: boolean;
  ownerLabel: string;
  /** True only for the hero/featured treatment (ChalybClip when usable now). */
  featured: boolean;
  /** PRO users can pick their single live engine from active+eligible cards. */
  canSelectLive: boolean;
  isSelectedLive: boolean;
}
