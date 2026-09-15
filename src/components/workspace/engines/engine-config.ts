// Shared types + structural config for the "Mis engines" hub.
//
// The DB (lib/data/engines.ts) owns each engine's identity, status, tier gate,
// and ownership. lib/billing/readiness.ts turns that + the user's entitlement
// into ONE display state per engine. Marketing copy (tagline + bullets) is
// localized in messages/*.json under `engines.marketing*` and resolved
// server-side in the page, then baked into each EngineVM as plain strings.
//
// This module is framework-agnostic (no 'use client'): the server page builds
// EngineVM[] and the client explorer renders them, both importing from here.

import type { EngineDisplayState } from '@/lib/billing/readiness';

/** The card's state IS the readiness state — one vocabulary, no translation
 *  layer where a badge could drift from what the user can actually do. */
export type EngineLiveState = EngineDisplayState;

/** The visual treatment a card renders with. `featured` is the wide card for
 *  the engine that is running live right now — the kit's mission-control
 *  spotlight, not a fixed hero for one product. */
export type EngineCardVariant = 'featured' | 'available' | 'locked' | 'soon';

/** Which actionability section an engine belongs to on the default (grouped)
 *  view. */
export type EngineSection = 'available' | 'pro' | 'soon';

/** The filter tabs above the grid. `all` always matches. */
export type EngineFilterKey = 'all' | 'live' | 'simulation' | 'coming_soon' | 'locked';

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
    case 'ready':
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
  return 'available'; // live | trial | ready | simulation
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
  /** True only for the wide spotlight treatment (the engine running live). */
  featured: boolean;
  /** Pro/Partner can point their live slot at this engine right now. */
  canSelectLive: boolean;
  isSelectedLive: boolean;
  /** Days left on the ChalyClip trial, for the trial badge. */
  trialDaysLeft: number;
}

/** What the hero tells the user to do next — decided on the server from the
 *  same readiness model as the cards, translated there, and passed down as
 *  plain strings. */
export interface EngineHeroAction {
  badge: string;
  heading: string;
  sub: string;
  ctaLabel: string;
  href: string;
  secondaryLabel: string | null;
  secondaryHref: string | null;
}
