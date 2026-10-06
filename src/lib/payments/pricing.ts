// What each plan and pack costs, in MINOR units, for the Mercado Pago
// builders (real money) and the webhook's price gate.
//
// Every amount here DERIVES from src/config/pricing.ts — the one pricing
// source — and includes IVA (Q1: list prices exclude it, so 16% is added).

import type { SubscriptionTier } from '@/lib/auth/session';
import { CURRENCY, planPrice, type PackId } from '@/config/pricing';

export interface TierPrice {
  /** Amount in minor units (cents). Avoids float rounding bugs. */
  amountCents: number;
  /** ISO 4217 currency code as MP expects (e.g. 'USD', 'MXN', 'ARS'). */
  currency: string;
  /** Human-friendly description shown on the MP checkout page. */
  description: string;
}

export const TIER_PRICING: Record<SubscriptionTier, TierPrice | null> = {
  // FREE is free — null means "no checkout needed; downgrade is just a tier write".
  FREE: null,
  PRO: {
    // Pro mensual, IVA included. Our MP account is country-locked to MX
    // (TEST tokens are issued per-country), so we use the local currency.
    amountCents: planPrice('pro_month').totalCents,
    currency: CURRENCY,
    description: 'Chalyb Pro',
  },
  // PARTNER is admin-granted, not sold via checkout. Keep at null so the
  // MP preference builder skips it and any /subscription page knows there's
  // no public price tag to show.
  PARTNER: null,
  VIP: {
    amountCents: planPrice('vip_month').totalCents,
    currency: CURRENCY,
    description: 'Chalyb VIP',
  },
};

/** Pretty money string from cents, e.g. 3900 USD → "$39.00 USD". */
export function formatMoney(amountCents: number, currency: string): string {
  const major = (amountCents / 100).toFixed(2);
  return `$${major} ${currency}`;
}

// ── Credit packs ────────────────────────────────────────────────────────
// Sold via MP checkout. Credits never expire and are spent after the plan's
// monthly ones. What each pack IS (id, credits) is fixed here; what it COSTS
// is the owner's setting (src/config/pack-pricing.ts), read per request on
// the server and passed in. Nothing here holds a price.

export interface TokenPackDef {
  /** Stable slug used in the order's external_reference. */
  id: PackId;
  /** Credits granted. Combined input+output, same units as TIER_CAPS. */
  tokens: number;
  /** Mercado Pago item label. */
  label: string;
}

export interface TokenPack extends TokenPackDef {
  /** Total in MXN centavos, IVA included: the owner's setting. */
  amountCents: number;
  /** Marketing tagline. */
  tagline: string;
}

export type PackTotals = Readonly<Record<PackId, number>>;

export const TOKEN_PACK_DEFS: readonly TokenPackDef[] = [
  { id: 'tokens_100k', tokens: 100_000, label: '+100k tokens' },
  { id: 'tokens_500k', tokens: 500_000, label: '+500k tokens' },
  { id: 'tokens_2m', tokens: 2_000_000, label: '+2M tokens' },
];

/** Whole percent less per credit than the smallest pack, rounded DOWN so a
 *  tagline never overstates the saving (LFPC art. 32). From the prices in
 *  force, so it stays true when they change. */
export function packSavingsPercent(id: PackId, totals: PackTotals): number {
  const def = (pid: PackId) => TOKEN_PACK_DEFS.find((d) => d.id === pid)!;
  const per = (pid: PackId) => totals[pid] / def(pid).tokens;
  return Math.max(0, Math.floor((1 - per(id) / per('tokens_100k')) * 100));
}

/** The packs with the prices in force. */
export function pricedTokenPacks(totals: PackTotals): TokenPack[] {
  const tag: Record<PackId, string> = {
    tokens_100k: 'Top-up rápido · alcanza para varios trabajos pequeños',
    tokens_500k: `${packSavingsPercent('tokens_500k', totals)}% menos por crédito que el paquete chico`,
    tokens_2m: `Mejor relación · ${packSavingsPercent('tokens_2m', totals)}% menos por crédito que el paquete chico`,
  };
  return TOKEN_PACK_DEFS.map((d) => ({ ...d, amountCents: totals[d.id], tagline: tag[d.id] }));
}

/** Packs are priced in MXN like the tiers. One constant so the checkout
 *  order and the webhook's amount check can't drift apart. */
export const TOKEN_PACK_CURRENCY = CURRENCY;

/** What a pack is (no price). */
export function getTokenPack(id: string): TokenPackDef | undefined {
  return TOKEN_PACK_DEFS.find((p) => p.id === id);
}
