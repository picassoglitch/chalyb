// Tier pricing — single source of truth for what each plan costs in MINOR units.
// Used by both the display strings in tiers.ts (cosmetic) and the MP preference
// builder (real money). Keep in sync if you change prices: tiers.ts is the
// pretty label, this file is the truth.

import type { SubscriptionTier } from '@/lib/auth/session';

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
    // MXN $749.00 = 74,900 centavos. Our MP account is country-locked to MX
    // (TEST tokens are issued per-country), so we use the local currency.
    // Round 4-digit pricing is the SaaS convention here, not strict USD conversion.
    amountCents: 74900,
    currency: 'MXN',
    description: 'Chalyb · Plan Pro · 1 sistema en vivo',
  },
  // PARTNER is admin-granted, not sold via checkout. Keep at null so the
  // MP preference builder skips it and any /subscription page knows there's
  // no public price tag to show.
  PARTNER: null,
  VIP: {
    // MXN $2,499.00 = 249,900 centavos.
    amountCents: 249900,
    currency: 'MXN',
    description: 'Chalyb · Plan VIP · todos los sistemas en vivo',
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

export const TOKEN_PACKS: TokenPack[] = [
  {
    id: 'tokens_100k',
    tokens: 100_000,
    amountCents: 14900, // MXN $149
    label: '+100k tokens',
    tagline: 'Top-up rápido · alcanza para varios trabajos pequeños',
  },
  {
    id: 'tokens_500k',
    tokens: 500_000,
    amountCents: 59900, // MXN $599 (5.5x más por 4x el precio)
    label: '+500k tokens',
    tagline: 'Mejor relación · ~30% descuento por token vs el pack chico',
  },
  {
    id: 'tokens_2m',
    tokens: 2_000_000,
    amountCents: 199900, // MXN $1,999 (20x por 13x el precio)
    label: '+2M tokens',
    tagline: 'Mejor relación · pensado para usuarios PRO con uso pesado',
  },
];

export function getTokenPack(id: string): TokenPack | undefined {
  return TOKEN_PACKS.find((p) => p.id === id);
}
