// Credit-pack prices: the owner edits them in Dueño → Ajustes (owner,
// 2026-10-04/05). Stored in public.app_settings under `pack_prices`
// (migration 0066 seeds the defaults). ONE value feeds the amount sent to
// Mercado Pago, the store (Mis créditos), the pack checkout, the webhook's
// price gate and the legal page /legal/packs.
//
// The owner types each price in pesos and says how IVA applies:
//   included  the typed price is the total the customer pays (IVA inside)
//   add       the typed price is before IVA; `ivaRatePercent` is added on top
// Either way the customer sees, accepts and pays the TOTAL, IVA included
// (MXN prices always include IVA; USD prices never do, and packs are MXN
// only).
//
// Pure: no imports outside config, so client code and tests can read it.

import { IVA_RATE_PERCENT, PACK_CENTS, type PackId } from './pricing';

export type PackIvaMode = 'included' | 'add';

export interface PackPricing {
  ivaMode: PackIvaMode;
  /** Only used when ivaMode = 'add'. Whole percent, 0–50. */
  ivaRatePercent: number;
  /** What the owner typed per pack, in centavos (total or pre-IVA per mode). */
  prices: Readonly<Record<PackId, number>>;
}

export const PACK_IDS: readonly PackId[] = ['tokens_100k', 'tokens_500k', 'tokens_2m'];

/** The app_settings key. Must match migration 0066. */
export const PACK_PRICES_SETTING = 'pack_prices';

/** $149 / $599 / $1,999 MXN, IVA included (owner, 2026-10-04). Migration 0066
 *  seeds the same row. */
export const DEFAULT_PACK_PRICING: PackPricing = {
  ivaMode: 'included',
  ivaRatePercent: IVA_RATE_PERCENT,
  prices: PACK_CENTS,
};

/** Bounds a typed price must stay in: $1 to $100,000 MXN. */
export const MIN_PACK_CENTS = 100;
export const MAX_PACK_CENTS = 10_000_000;
export const MAX_IVA_RATE_PERCENT = 50;

const isWhole = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/**
 * A stored or submitted value → a valid PackPricing, or null. Strict: any
 * missing pack, fractional centavo, out-of-range price or unknown mode is
 * null, and the caller fails closed (no checkout, no store prices).
 */
export function parsePackPricing(raw: unknown): PackPricing | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.ivaMode !== 'included' && r.ivaMode !== 'add') return null;
  if (!isWhole(r.ivaRatePercent, 0, MAX_IVA_RATE_PERCENT)) return null;
  const p = r.prices;
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  const prices = {} as Record<PackId, number>;
  for (const id of PACK_IDS) {
    const v = (p as Record<string, unknown>)[id];
    if (!isWhole(v, MIN_PACK_CENTS, MAX_PACK_CENTS)) return null;
    prices[id] = v;
  }
  return { ivaMode: r.ivaMode, ivaRatePercent: r.ivaRatePercent, prices };
}

/** What the customer pays for a pack, IVA included, in centavos. */
export function packTotalCents(cfg: PackPricing, id: PackId): number {
  const typed = cfg.prices[id];
  if (cfg.ivaMode === 'included') return typed;
  return Math.round((typed * (100 + cfg.ivaRatePercent)) / 100);
}

/** Every pack's total, IVA included, in centavos. */
export function packTotals(cfg: PackPricing): Readonly<Record<PackId, number>> {
  const out = {} as Record<PackId, number>;
  for (const id of PACK_IDS) out[id] = packTotalCents(cfg, id);
  return out;
}

/** The IVA inside a pack total at the configured rate (0 when the owner set
 *  the rate to 0 in 'add' mode; the general rate otherwise). */
export function packIvaCents(cfg: PackPricing, id: PackId): number {
  const total = packTotalCents(cfg, id);
  const rate = cfg.ivaMode === 'add' ? cfg.ivaRatePercent : IVA_RATE_PERCENT;
  return total - Math.round((total * 100) / (100 + rate));
}

/** Pesos as typed in a form ("1,999.50", "149") → centavos, or null. */
export function pesosToCents(input: string): number | null {
  const s = input.replace(/[,\s$]/g, '');
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}
