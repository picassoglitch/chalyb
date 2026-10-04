// What each plan and pack costs, in MINOR units, for the Mercado Pago
// builders (real money) and the webhook's price gate.
//
// Every amount here DERIVES from src/config/pricing.ts — the one pricing
// source — and includes IVA (Q1: list prices exclude it, so 16% is added).

import type { SubscriptionTier } from '@/lib/auth/session';
import { CURRENCY, packPriceCents, planPrice } from '@/config/pricing';

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

// ── Token top-up packs ────────────────────────────────────────────────────
// Sold via MP checkout. Tokens never expire and stack on top of the user's
// monthly tier allocation. Priced so the per-token rate gets cheaper at
// higher pack sizes — encourages buying once vs many micro-packs.

export interface TokenPack {
  /** Stable slug used as the MP preference's external_reference. */
  id: 'tokens_100k' | 'tokens_500k' | 'tokens_2m';
  /** Tokens granted. Combined input+output, same units as TIER_CAPS. */
  tokens: number;
  /** Price in MXN minor units (centavos). */
  amountCents: number;
  /** Display label for the buy button. */
  label: string;
  /** Marketing tagline. */
  tagline: string;
}

/** Whole percent less per credit than the smallest pack, rounded DOWN so a
 *  tagline never overstates the saving (LFPC art. 32). From the real prices,
 *  so it stays true when they change. */
export function packSavingsPercent(id: TokenPack['id']): number {
  const per = (pid: TokenPack['id'], tokens: number) => packPriceCents(pid) / tokens;
  const base = per('tokens_100k', 100_000);
  const tokens = { tokens_100k: 100_000, tokens_500k: 500_000, tokens_2m: 2_000_000 }[id];
  return Math.max(0, Math.floor((1 - per(id, tokens) / base) * 100));
}

export const TOKEN_PACKS: TokenPack[] = [
  {
    id: 'tokens_100k',
    tokens: 100_000,
    amountCents: packPriceCents('tokens_100k'),
    label: '+100k tokens',
    tagline: 'Top-up rápido · alcanza para varios trabajos pequeños',
  },
  {
    id: 'tokens_500k',
    tokens: 500_000,
    amountCents: packPriceCents('tokens_500k'),
    label: '+500k tokens',
    tagline: `${packSavingsPercent('tokens_500k')}% menos por crédito que el paquete chico`,
  },
  {
    id: 'tokens_2m',
    tokens: 2_000_000,
    amountCents: packPriceCents('tokens_2m'),
    label: '+2M tokens',
    tagline: `Mejor relación · ${packSavingsPercent('tokens_2m')}% menos por crédito que el paquete chico`,
  },
];

/** Packs are priced in MXN like the tiers. One constant so the checkout
 *  preference and the webhook's amount check can't drift apart. */
export const TOKEN_PACK_CURRENCY = CURRENCY;

export function getTokenPack(id: string): TokenPack | undefined {
  return TOKEN_PACKS.find((p) => p.id === id);
}
