// Shared types for the command center data layer.
// UI components depend on these — never on Supabase row shapes directly.
//
// NAMING: We call these "Engines" (the revenue-producing products), paired
// conceptually with Chalyb Academy on the learn side. The codebase used to
// say "bots" everywhere; renamed in migration 0010 since not all engines
// are bots (ChalybClip is a video pipeline, ChalybStreamManager is a control
// panel, ChalybRealtor is a scraper, etc.).

import type { SubscriptionTier } from '@/lib/auth/session';

export type EngineState = 'HEALTHY' | 'TRAINING' | 'RENDERING' | 'DELAYED' | 'ERROR' | 'OFFLINE';
export type EngineStateCode = 'g' | 'c' | 'p' | 'a' | 'r' | 'o';
export type EngineCategory =
  | 'TRADING'
  | 'STREAMING'
  | 'CONTENT'
  | 'AGENTS'
  | 'RESEARCH'
  | 'INTERNAL';
export type EngineEnv = 'PRODUCTION' | 'STAGING' | 'LOCAL' | 'GPU_NODE';
/** Lifecycle of an engine listing. Drives the UI badges + whether the
 *  "activate" button is enabled. */
export type EngineStatus = 'active' | 'coming_soon' | 'deprecated';

/** How "Abrir engine →" actually opens the thing. See migration 0012 for the
 *  full rationale of each mode. */
export type EngineIntegrationMode =
  | 'internal_placeholder'
  | 'external_sso_redirect'
  | 'iframe_embed';

export const STATE_TO_CODE: Record<EngineState, EngineStateCode> = {
  HEALTHY: 'g',
  TRAINING: 'c',
  RENDERING: 'p',
  DELAYED: 'a',
  ERROR: 'r',
  OFFLINE: 'o',
};

export const STATE_LABEL: Record<EngineStateCode, string> = {
  g: 'Healthy',
  c: 'Training',
  p: 'Rendering',
  a: 'Delayed',
  r: 'Error',
  o: 'Offline',
};

export const ENV_LABEL: Record<EngineEnv, string> = {
  PRODUCTION: 'Production',
  STAGING: 'Staging',
  LOCAL: 'Local',
  GPU_NODE: 'GPU node',
};

export const CATS: { id: EngineCategory; label: string; slug: string }[] = [
  { id: 'TRADING', label: 'Trading', slug: 'trading' },
  { id: 'STREAMING', label: 'Streaming', slug: 'streaming' },
  { id: 'CONTENT', label: 'Content AI', slug: 'content' },
  { id: 'AGENTS', label: 'AI Agents', slug: 'agents' },
  { id: 'RESEARCH', label: 'Research', slug: 'research' },
  { id: 'INTERNAL', label: 'Internal', slug: 'internal' },
];

export interface Engine {
  id: string;
  slug: string;
  name: string;
  icon: string;
  category: EngineCategory;
  type: string;
  env: EngineEnv;
  region: string;
  node: string;
  description: string;
  featured: boolean;
  state: EngineState;
  stateCode: EngineStateCode;
  health: number;
  latencyMs: number;
  revenueCents: number;
  favorite: boolean;
  /** Lifecycle status — 'active' engines can be activated live, 'coming_soon'
   *  show a teaser badge and disabled CTA. */
  status: EngineStatus;
  /** Minimum subscription tier required to run this engine live. */
  tierRequired: SubscriptionTier;
  /** External URL where the engine's UI lives (NULL for internal-only engines). */
  externalUrl: string | null;
  /** How the "Open engine" CTA opens the thing. */
  integrationMode: EngineIntegrationMode;
  /** Base URL for Chalyb's admin-side API calls into this engine. */
  adminApiBase: string | null;
  /** When true, Chalyb provisions a tenant in the engine on first activation. */
  requiresProvisioning: boolean;
  /** Partner who owns this engine (null = platform-owned default). The
   *  marketplace shows a "by Partner X" attribution chip on owned engines,
   *  and the owner's /app surfaces treat the engine as always-live regardless
   *  of selected_engine_id (see engineCanRunLive). */
  ownerUserId: string | null;
  /** Display name for the owner — pre-joined for the "by Partner X" badge.
   *  Empty when no owner or when the owner has no full_name set on their
   *  profile (we fall back to email local-part on the UI side). */
  ownerDisplayName: string | null;
  ownerEmail: string | null;
  /** Royalty rate paid to the owner per 1M tokens consumed in this engine.
   *  Integer cents. 0 = no royalty (default; platform-owned engines). Set
   *  inline from the admin /dashboard/engines table. */
  partnerRoyaltyPerMillionTokensCents: number;
  /** What the platform pays providers (Claude API, etc.) per 1M tokens
   *  consumed in this engine. Cents MXN. 0 = admin hasn't set yet. Used
   *  by the per-engine detail page to compute LLM variable cost + margin. */
  costPerMillionTokensCents: number;
  /** Monthly fixed infra cost (Modal baseline, allocated Vercel/Railway
   *  slice, dedicated nodes) — does not scale with usage. Cents MXN. */
  fixedMonthlyCostCents: number;
  persona?: EnginePersona;
}

export interface EnginePersona {
  persona: string;
  tone: string;
  goals: string;
  focus: string;
  learningState: string;
  engagementScore: number;
}

export interface ActivityEvent {
  id: string;
  kind: EngineStateCode;
  title: string;
  /** The engine that produced this event (display name). */
  engine: string;
  meta: string;
  time: string; // HH:MM
}

export type StripMetricId = 'active' | 'aicalls' | 'rev' | 'streams' | 'queue' | 'gpu';

export interface StripValue {
  id: StripMetricId;
  value: number;
  hist: number[]; // last 14 points for sparkline
}

export interface StreamTick {
  kind: 'strip' | 'activity' | 'health' | 'rail';
  strip?: StripValue[];
  event?: ActivityEvent;
  health?: Array<{ engineId: string; health: number }>;
  rail?: {
    jobsPerHour: number;
    queue: number;
    tokensToday: string;
    revenueToday: number;
  };
}

// ── Back-compat aliases ──────────────────────────────────────────────────
// Old names still used in a few un-migrated component spots. Keep these
// re-exports so the migration can happen file-by-file without breaking the
// build at each commit. Remove once all imports point at the new names.
export type Bot = Engine;
export type BotPersona = EnginePersona;
export type BotState = EngineState;
export type BotStateCode = EngineStateCode;
export type BotCategory = EngineCategory;
export type BotEnv = EngineEnv;
