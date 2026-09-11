// Single source of truth for what each subscription tier unlocks.
// Every UI badge, quota meter, server-side check, and paywall reads from here.
// Updating a tier's capabilities = edit this file. No magic numbers elsewhere.

import type { SubscriptionTier, UserRole } from '@/lib/auth/session';

/**
 * ROLE OVERRIDES TIER.
 * SUPER_ADMIN and ADMIN bypass all tier restrictions — they get VIP
 * capabilities regardless of what's stored in profiles.tier. The stored tier
 * is still shown on /app/subscription for billing transparency, but every
 * other surface (quotas, live-bot badges, paywalls) reads effectiveTier().
 */
export function isAdminRole(role: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN';
}

export function effectiveTier(role: UserRole, storedTier: SubscriptionTier): SubscriptionTier {
  if (isAdminRole(role)) return 'VIP';
  return storedTier;
}

/**
 * Is this tier the partner program tier?
 * Centralized so /app surfaces can render the "Partner · plus your own engine"
 * badge consistently without re-coding the comparison everywhere.
 */
export function isPartnerTier(tier: SubscriptionTier): boolean {
  return tier === 'PARTNER';
}

/** ChalybClip's max export resolution per tier. Ordered ascending so callers
 *  can compare with EXPORT_QUALITY_RANK below. */
export type ClipExportQuality = 'sd' | 'hd' | '4k';

export const EXPORT_QUALITY_RANK: Record<ClipExportQuality, number> = {
  sd: 0,
  hd: 1,
  '4k': 2,
};

/** Which community space the tier unlocks. */
export type CommunityAccess = 'free' | 'premium';

export interface TierCapabilities {
  // ── Chalyb ───────────────────────────────────────────────────────────
  /** How many engines the user can run in LIVE execution (not simulation).
   *  FREE = 0 (all simulation only).
   *  PRO = 1 (the engine they pick via profiles.selected_engine_id).
   *  VIP = Infinity (every engine in their org is live). */
  liveEnginesCount: number;
  /** Monthly job execution cap. */
  jobsPerMonth: number;
  /** Monthly AI token budget. */
  tokensPerMonth: number;
  /** Storage cap in MB for clips / VODs / uploads. */
  storageMB: number;
  /** Concurrent live streams allowed (0 = no live streaming, simulation only). */
  activeStreams: number;
  /** Historial retention in days. */
  historyDays: number;
  /** Whether advanced analytics dashboards unlock. */
  hasAdvancedAnalytics: boolean;
  /** Whether the user gets priority support. */
  hasPrioritySupport: boolean;
  /** Whether the user sees alpha / preview features. */
  hasEarlyAccess: boolean;
  /** Which community space this tier unlocks (free vs premium). */
  community: CommunityAccess;

  // ── ChalybClip ──────────────────────────────────────────────────────────
  // These travel to ChalybClip via the SSO tier string; ChalybClip enforces them
  // on its side keyed off the same tier. Modeling them here keeps ONE source
  // of truth so the two products' plans stay in harmony — the /app paywalls,
  // the marketing cards, and ChalybClip's gates all read the same ladder.
  /** Whether exported clips carry the "ChalybClip" watermark. */
  clipWatermark: boolean;
  /** VOD retention window in days before clips are pruned. */
  clipVodRetentionDays: number;
  /** Live streams ChalybClip allows per month (Infinity = uncapped). */
  clipStreamsPerMonth: number;
  /** Highest export resolution ChalybClip will render. */
  clipExportMaxQuality: ClipExportQuality;
  /** Whether clips can auto-publish (false = manual download only). */
  clipAutoPublish: boolean;
  /** How many brand kits ChalybClip stores (Infinity = uncapped). */
  clipBrandKits: number;
  /** Whether the user can auto-ingest VODs from a watched Google Drive folder
   *  (ChalybClip "Watch a Drive folder"). false = manual upload only. Gated here
   *  so ChalybClip reads it off the SSO tier like every other clip cap. */
  clipDriveAutoIngest: boolean;
  /** Whether the user can connect their own social accounts (TikTok/IG/YT/…)
   *  and one-click publish clips via the Zernio publishing API. This is the
   *  COGS-bearing action (Zernio bills per connected account), so it's tier-
   *  gated. `clipAutoPublish` above is the stronger VIP perk: hands-off
   *  auto-publish + scheduling on top of connect. */
  clipConnectSocials: boolean;

  // ── Display ───────────────────────────────────────────────────────────
  label: string;
  price: string;
  per: string;
}

export const TIER_CAPS: Record<SubscriptionTier, TierCapabilities> = {
  FREE: {
    liveEnginesCount: 0,
    jobsPerMonth: 100,
    tokensPerMonth: 50_000,
    storageMB: 500,
    activeStreams: 0,
    historyDays: 7,
    hasAdvancedAnalytics: false,
    hasPrioritySupport: false,
    hasEarlyAccess: false,
    community: 'free',
    // ChalybClip Free: watermarked clips, short VOD window, manual download only.
    clipWatermark: true,
    clipVodRetentionDays: 7,
    clipStreamsPerMonth: 0,
    clipExportMaxQuality: 'sd',
    clipAutoPublish: false,
    clipBrandKits: 0,
    clipDriveAutoIngest: false,
    clipConnectSocials: false,
    label: 'Free',
    price: '$0',
    per: 'siempre',
  },
  PRO: {
    liveEnginesCount: 1,
    // 1,000,000 tokens/month, regenerated on the 1st (see lib/usage/tokens.ts).
    jobsPerMonth: 2_000,
    tokensPerMonth: 1_000_000,
    storageMB: 5_000,
    activeStreams: 1,
    historyDays: 90,
    hasAdvancedAnalytics: true,
    hasPrioritySupport: false,
    hasEarlyAccess: false,
    community: 'premium',
    // ChalybClip Pro ("el streamer"): no watermark, ~12 streams/mo, HD-only
    // export, one brand kit. Auto-publish stays a VIP-only perk. Out of tokens
    // before month end → prompted to buy a top-up pack (TOKEN_PACKS).
    clipWatermark: false,
    clipVodRetentionDays: 90,
    clipStreamsPerMonth: 12,
    clipExportMaxQuality: 'hd',
    clipAutoPublish: false,
    clipBrandKits: 1,
    clipDriveAutoIngest: true,
    clipConnectSocials: true,
    label: 'Pro',
    price: 'MXN $749',
    per: 'mes',
  },
  // PARTNER = PRO + 1 owned engine. The owned engine is ALWAYS live regardless
  // of selected_engine_id (enforced in engineCanRunLive below), so the
  // effective live count is 2: their owned + the slot they pick. We keep
  // liveEnginesCount = 1 here because the value drives the *selectable* slot
  // count on /app surfaces — partners pick 1 like PRO does. The owned engine
  // is bonus capacity outside the slot mechanic. ChalybClip caps mirror PRO.
  PARTNER: {
    liveEnginesCount: 1,
    jobsPerMonth: 2_000,
    tokensPerMonth: 1_000_000,
    storageMB: 5_000,
    activeStreams: 1,
    historyDays: 180,
    hasAdvancedAnalytics: true,
    hasPrioritySupport: true,
    hasEarlyAccess: true,
    community: 'premium',
    clipWatermark: false,
    clipVodRetentionDays: 90,
    clipStreamsPerMonth: 12,
    clipExportMaxQuality: 'hd',
    clipAutoPublish: false,
    clipBrandKits: 1,
    clipDriveAutoIngest: true,
    clipConnectSocials: true,
    label: 'Partner',
    price: 'Programa',
    per: '',
  },
  // VIP (was "All-Access"): every engine live, 5× PRO tokens, and the full
  // ChalybClip feature set unlocked — no caps on streams, brand kits, or export.
  VIP: {
    liveEnginesCount: Infinity,
    jobsPerMonth: 20_000,
    tokensPerMonth: 5_000_000,
    storageMB: 50_000,
    activeStreams: 5,
    historyDays: 365,
    hasAdvancedAnalytics: true,
    hasPrioritySupport: true,
    hasEarlyAccess: true,
    community: 'premium',
    clipWatermark: false,
    clipVodRetentionDays: 365,
    clipStreamsPerMonth: Infinity,
    clipExportMaxQuality: '4k',
    clipAutoPublish: true,
    clipBrandKits: Infinity,
    clipDriveAutoIngest: true,
    clipConnectSocials: true,
    label: 'VIP',
    price: 'MXN $2,499',
    per: 'mes',
  },
};

/**
 * Returns whether a specific engine is allowed in LIVE mode for the given user state.
 * - FREE: never live.
 * - PRO: live if it's their selected_engine_id, else simulation.
 * - PARTNER: same as PRO for selection-slot mechanics, PLUS their owned engine
 *   is always live regardless of selection. Callers must pass `isOwnedByUser`
 *   so this function stays a pure predicate; the caller is responsible for
 *   joining engines.owner_user_id against the current user id.
 * - VIP: always live.
 *
 * Tier-required check is separate — even a VIP user can't activate
 * an engine marked tier_required = VIP if their effective tier is lower.
 * Callers should combine: engineCanRunLive(...) && tier >= engine.tierRequired.
 */
export function engineCanRunLive(
  tier: SubscriptionTier,
  engineId: string,
  selectedEngineId: string | null,
  isOwnedByUser: boolean = false,
): boolean {
  // Partner-owned engines short-circuit to always-live. The owned engine is
  // bonus capacity outside the selection mechanic — partners get their slot
  // AND their own.
  if (isOwnedByUser) return true;
  const caps = TIER_CAPS[tier];
  if (caps.liveEnginesCount === 0) return false;
  if (caps.liveEnginesCount === Infinity) return true;
  // PRO + PARTNER (or any finite > 0 case) — must match selection.
  return engineId === selectedEngineId;
}

// Back-compat alias — remove after all call sites migrated.
export { engineCanRunLive as botCanRunLive };

// ── ChalybClip 7-day trial ───────────────────────────────────────────────────
// First-time users get ChalybClip running LIVE (Pro-level) for 7 days, even on
// FREE. The trial grants live access to ChalybClip ONLY — every other engine
// stays gated by tier. Backed by profiles.chalybclip_trial_started_at (set when
// the user accepts the welcome banner, or by an admin from /dashboard/team).
//
// These helpers are pure: callers pass `nowMs` (Date.now()) so the logic stays
// testable and SSR-deterministic within a single render.

/** The engine slug the trial unlocks. */
export const CHALYBCLIP_TRIAL_SLUG = 'chalybclip';
/** Trial length in days. */
export const CHALYBCLIP_TRIAL_DAYS = 7;
const TRIAL_MS = CHALYBCLIP_TRIAL_DAYS * 24 * 60 * 60 * 1000;

/** Is the ChalybClip trial currently active for a profile with this start time? */
export function isChalybclipTrialActive(startedAtIso: string | null, nowMs: number): boolean {
  if (!startedAtIso) return false;
  const startMs = Date.parse(startedAtIso);
  if (Number.isNaN(startMs)) return false;
  return nowMs < startMs + TRIAL_MS;
}

/** Whole days left on the trial (rounded up), clamped to 0..CHALYBCLIP_TRIAL_DAYS.
 *  0 when there's no active trial. */
export function chalybclipTrialDaysLeft(startedAtIso: string | null, nowMs: number): number {
  if (!startedAtIso) return 0;
  const startMs = Date.parse(startedAtIso);
  if (Number.isNaN(startMs)) return 0;
  const remainingMs = startMs + TRIAL_MS - nowMs;
  if (remainingMs <= 0) return 0;
  return Math.min(CHALYBCLIP_TRIAL_DAYS, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
}

/**
 * Post-trial grace: the 7-day clock has run out, but the user still has
 * PURCHASED/persistent tokens left — so we keep ChalybClip live until those are
 * gone ("we know your time ran out, but we like you"). True only once the trial
 * window has CLOSED (an active trial isn't grace) and bonus tokens remain.
 * Drives both the live gate and the grace banner on /app.
 *
 * `bonusTokens` is the user's persistent top-up/gift balance
 * (TokenBalance.bonus) — deliberately NOT the monthly allocation, which
 * regenerates on the 1st. Keying off bonus means grace ends FOR GOOD once the
 * non-renewing tokens are spent, rather than reopening every month. Admins/
 * unlimited never hit this path — they meet the tier outright.
 */
export function isChalybclipGraceActive(
  startedAtIso: string | null,
  nowMs: number,
  bonusTokens: number,
): boolean {
  if (!startedAtIso) return false;
  if (isChalybclipTrialActive(startedAtIso, nowMs)) return false; // still in the trial proper
  return bonusTokens > 0;
}

/**
 * Whether `engineSlug` runs LIVE for a user, folding in the ChalybClip trial on
 * top of the normal tier/selection/ownership rules. Centralizes the formula so
 * the home page, engines list, and engine detail page all agree.
 *
 * The trial short-circuits BOTH the tier-required gate and the selection gate —
 * a FREE trial user sees ChalybClip (tier_required = PRO) as live without a
 * selection. Pass `meetsTier` (caller already computes tier_required vs tier),
 * `trialActive` (isChalybclipTrialActive), and `graceActive` (isChalybclipGraceActive,
 * the post-trial "still has tokens" window). Trial and grace behave identically
 * for the live gate — both keep ChalybClip running; they differ only in the banner
 * the UI shows.
 */
export function engineIsLiveForUser(opts: {
  tier: SubscriptionTier;
  engineId: string;
  engineSlug: string;
  engineStatus: string;
  meetsTier: boolean;
  selectedEngineId: string | null;
  isOwnedByUser?: boolean;
  trialActive?: boolean;
  graceActive?: boolean;
}): boolean {
  if (opts.engineStatus !== 'active') return false;
  const clipUnlocked =
    (!!opts.trialActive || !!opts.graceActive) && opts.engineSlug === CHALYBCLIP_TRIAL_SLUG;
  const meetsTierOrClip = opts.meetsTier || clipUnlocked;
  if (!meetsTierOrClip) return false;
  return (
    clipUnlocked ||
    engineCanRunLive(opts.tier, opts.engineId, opts.selectedEngineId, opts.isOwnedByUser ?? false)
  );
}

/** Pretty tier name for sidebar pills + headings. */
export function tierLabelShort(tier: SubscriptionTier): string {
  return tier; // 'FREE' | 'PRO' | 'PARTNER' | 'VIP'
}

/** Quotas formatted as the UI list expects them. */
export interface QuotaRow {
  label: string;
  used: number;
  cap: number;
  unit: string;
  sub?: string;
}

export function buildQuotaRows(tier: SubscriptionTier): QuotaRow[] {
  const caps = TIER_CAPS[tier];
  return [
    {
      label: 'Trabajos IA · este mes',
      used: 0,
      cap: caps.jobsPerMonth,
      unit: 'trabajos',
      sub: 'Reinicia el día 1',
    },
    {
      label: 'Tokens IA · este mes',
      used: 0,
      cap: caps.tokensPerMonth,
      unit: 'tokens',
      sub: 'Across all sistemas',
    },
    {
      label: 'Almacenamiento',
      used: 0,
      cap: caps.storageMB,
      unit: 'MB',
      sub: 'Clips · VODs · uploads',
    },
    {
      label: 'Engines en vivo',
      used: 0,
      cap: caps.liveEnginesCount === Infinity ? 999 : caps.liveEnginesCount,
      unit: caps.liveEnginesCount === 0 ? 'engine en vivo · solo simulación' : 'engines',
      sub:
        tier === 'PRO'
          ? 'tú eliges cuál'
          : tier === 'FREE'
            ? 'upgrade a Pro'
            : tier === 'PARTNER'
              ? '1 a elegir · tu engine propio siempre activo'
              : 'todos disponibles',
    },
  ];
}
