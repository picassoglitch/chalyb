// The plan cards' bullets, from TIER_CAPS (PRICING-CARDS-SPEC §5.6, K-9).
// Pure. Only real, enforced limits: no tool count, no "todas las
// herramientas" (C4 / C15), no credits or jobs.
//
// D8 · the Clips caps live in the separate Clips app. What it enforces
// (watermark on Gratis, 4K on VIP only) always shows; what it doesn't yet
// (Gratis in SD, no live-stream clips on Gratis) shows only with
// PLAN_FEATURE_CLIP_LIMITS_ENFORCED (flags.ts). TODO(owner D8).

import { TIER_CAPS } from './tiers';

export interface PlanFeature {
  /** plans.feat.<key> */
  key:
    | 'clipsTry'
    | 'clipsTryWatermark'
    | 'noWatermarkHd'
    | 'clips4k'
    | 'noStreams'
    | 'streams'
    | 'streamsUnlimited'
    | 'history'
    | 'historyYear'
    | 'storage'
    | 'cancel';
  values?: Record<string, string | number>;
  /** false = shown crossed out ("No incluye"). */
  included: boolean;
}

/** "500 MB", "5 GB", "50 GB": decimal, like the caps themselves. */
export function storageLabel(mb: number): string {
  return mb >= 1000 ? `${mb / 1000} GB` : `${mb} MB`;
}

type Tier = 'FREE' | 'PRO' | 'VIP';

interface FeatureOpts {
  freeIncludesClips: boolean;
  /** D8 · the Clips app enforces Gratis' SD cap and 0 live streams. */
  clipLimitsEnforced?: boolean;
}

function clipsFeature(tier: Tier, opts: FeatureOpts): PlanFeature | null {
  const q = TIER_CAPS[tier].clipExportMaxQuality;
  if (tier === 'FREE')
    return { key: opts.clipLimitsEnforced ? 'clipsTry' : 'clipsTryWatermark', included: true };
  if (q === '4k') return { key: 'clips4k', included: true };
  return TIER_CAPS[tier].clipWatermark ? null : { key: 'noWatermarkHd', included: true };
}

function streamsFeature(tier: Tier): PlanFeature {
  const n = TIER_CAPS[tier].clipStreamsPerMonth;
  if (n === Infinity) return { key: 'streamsUnlimited', included: true };
  if (n <= 0) return { key: 'noStreams', included: false };
  return { key: 'streams', values: { n }, included: true };
}

function historyFeature(tier: Tier): PlanFeature {
  const dias = TIER_CAPS[tier].historyDays;
  return dias >= 365
    ? { key: 'historyYear', included: true }
    : { key: 'history', values: { dias }, included: true };
}

/**
 * Gratis: what it has, plus what it lacks crossed out. Pro: its own list.
 * VIP: only what is ABOVE Pro (the card's header says "Todo lo de Pro, más:").
 */
export function planFeatures(tier: Tier, opts: FeatureOpts): PlanFeature[] {
  const all = (t: Tier): PlanFeature[] => {
    const clips = clipsFeature(t, opts);
    return [
      ...(clips && (t !== 'FREE' || opts.freeIncludesClips) ? [clips] : []),
      ...(t === 'FREE' ? [] : [streamsFeature(t)]),
      historyFeature(t),
      { key: 'storage', values: { espacio: storageLabel(TIER_CAPS[t].storageMB) }, included: true },
      ...(t === 'FREE' && opts.clipLimitsEnforced ? [streamsFeature(t)] : []),
      ...(t === 'PRO' ? [{ key: 'cancel', included: true } as PlanFeature] : []),
    ];
  };
  if (tier !== 'VIP') return all(tier);
  const pro = all('PRO');
  const same = (a: PlanFeature, b: PlanFeature) =>
    a.key === b.key && JSON.stringify(a.values ?? {}) === JSON.stringify(b.values ?? {});
  return all('VIP').filter((f) => !pro.some((p) => same(p, f)));
}
