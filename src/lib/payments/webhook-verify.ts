// Mercado Pago webhook verification — pure functions, no I/O.
//
// Split out of the route so both halves of "is this payment real?" can be
// unit-tested without a live MP account or a database:
//   1. checkMpSignature  — is the caller actually Mercado Pago?
//   2. expectedCharge*   — did they pay what this entitlement costs?
//
// Both are fail-closed. A missing secret is a REJECT, not a pass: treating an
// unconfigured secret as "verified" meant anyone who could reach the public
// webhook URL could POST a payment id and be granted a paid tier.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { TIER_PRICING, getTokenPack, TOKEN_PACK_CURRENCY } from './pricing';
import {
  GRANDFATHERED_CENTS,
  grandfatheredFor,
  lealtadSchedule,
  planPrice,
  PRICING,
  type PlanKey,
} from '@/config/pricing';
import type { SubscriptionTier } from '@/lib/auth/session';
import { AMOUNT_MISMATCH_STATUS } from '@/lib/billing/billing-state';

export type SignatureFailure =
  | 'stale'
  | 'not_configured'
  | 'missing_headers'
  | 'malformed_signature'
  | 'mismatch';

export type SignatureCheck = { ok: true } | { ok: false; reason: SignatureFailure };

/**
 * MP signs the webhook with HMAC-SHA256 over the manifest
 *   `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * where ts comes out of the x-signature header itself. A part whose value
 * is absent (no data.id, no x-request-id) is left out of the manifest, as
 * MP's docs say; ts is always required.
 * https://www.mercadopago.com/developers/en/docs/your-integrations/notifications/webhooks
 */
export function signatureManifest(opts: {
  dataId: string | null | undefined;
  requestId: string | null | undefined;
  ts: string;
}): string {
  return (
    (opts.dataId ? `id:${opts.dataId};` : '') +
    (opts.requestId ? `request-id:${opts.requestId};` : '') +
    `ts:${opts.ts};`
  );
}

export function checkMpSignature(opts: {
  secret: string | undefined | null;
  /** data.id as it goes into the manifest (manifestId(): lowercased). */
  paymentId: string | null;
  requestId: string | null;
  signatureHeader: string | null;
  /** With it, a validly signed notification whose ts is further than
   *  MP_SIGNATURE_MAX_SKEW_MS from this clock is refused as 'stale' (a
   *  captured request replayed later). */
  nowMs?: number;
}): SignatureCheck {
  const secret = opts.secret?.trim();
  // No secret configured → we cannot tell MP from anyone else on the internet.
  // The only safe answer is no.
  if (!secret) return { ok: false, reason: 'not_configured' };

  if (!opts.signatureHeader) return { ok: false, reason: 'missing_headers' };

  // x-signature looks like: "ts=1733520000,v1=abc123..."
  const parts = Object.fromEntries(
    opts.signatureHeader.split(',').map((s) => {
      const [k, v] = s.split('=').map((x) => x.trim());
      return [k, v];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1 || !/^[0-9a-f]+$/i.test(v1)) {
    return { ok: false, reason: 'malformed_signature' };
  }

  const manifest = signatureManifest({ dataId: opts.paymentId, requestId: opts.requestId, ts });
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(v1, 'hex');
    // timingSafeEqual throws on a length mismatch; a wrong-length digest is a
    // mismatch either way.
    if (a.length !== b.length) return { ok: false, reason: 'mismatch' };
    if (!timingSafeEqual(a, b)) return { ok: false, reason: 'mismatch' };
  } catch {
    return { ok: false, reason: 'mismatch' };
  }
  if (opts.nowMs !== undefined) {
    const at = signatureTsMs(ts);
    if (at === null || Math.abs(opts.nowMs - at) > MP_SIGNATURE_MAX_SKEW_MS) {
      return { ok: false, reason: 'stale' };
    }
  }
  return { ok: true };
}

/** How far a signature's ts may be from our clock (either way). */
export const MP_SIGNATURE_MAX_SKEW_MS = 10 * 60 * 1000;

/** The x-signature ts as epoch milliseconds. MP documents it in
 *  milliseconds (13 digits) but some notifications carry seconds (10
 *  digits): anything below 1e12 is read as seconds. */
export function signatureTsMs(ts: string): number | null {
  if (!/^\d{1,16}$/.test(ts)) return null;
  const n = Number(ts);
  return n < 1e12 ? n * 1000 : n;
}

export interface ExpectedCharge {
  amountCents: number;
  /** Earlier prices still honoured: subscriptions and checkouts created
   *  before the current prices keep charging them (config
   *  GRANDFATHERED_CENTS) until the subscriber accepts the new price. */
  alsoAcceptCents?: readonly number[];
  currency: string;
  /** What is being bought, for logs and audit metadata. */
  label: string;
}

/** What a tier upgrade must cost. null = this tier is not for sale (FREE has
 *  no price, PARTNER is admin-granted), so no payment can ever grant it. */
export function expectedChargeForTier(tier: SubscriptionTier): ExpectedCharge | null {
  const price = TIER_PRICING[tier];
  if (!price) return null;
  const legacy = tier === 'PRO' || tier === 'VIP' ? GRANDFATHERED_CENTS[tier] : [];
  return {
    amountCents: price.amountCents,
    alsoAcceptCents: legacy,
    currency: price.currency,
    label: `tier ${tier}`,
  };
}

/** What a token pack must cost. null = unknown pack id. */
export function expectedChargeForPack(packId: string): ExpectedCharge | null {
  const pack = getTokenPack(packId);
  if (!pack) return null;
  return {
    amountCents: pack.amountCents,
    alsoAcceptCents: GRANDFATHERED_CENTS.packs[pack.id],
    currency: TOKEN_PACK_CURRENCY,
    label: `pack ${pack.id}`,
  };
}

export type ChargeCheck =
  | { ok: true }
  | {
      ok: false;
      reason: 'amount' | 'currency';
      expected: ExpectedCharge;
      paidCents: number;
      paidCurrency: string;
    };

/**
 * Compare what MP says was paid against what the entitlement costs.
 *
 * Exact match on both (or on a grandfathered pre-IVA price), because the
 * amount MP reports is the amount WE put on
 * the preference — any difference means the reference was replayed against a
 * different (cheaper) payment, or the preference was built elsewhere. Neither
 * should grant anything.
 */
export function checkCharge(
  expected: ExpectedCharge,
  paid: { amountMajor: number | null | undefined; currency: string | null | undefined },
): ChargeCheck {
  const paidCents = Math.round((paid.amountMajor ?? 0) * 100);
  const paidCurrency = (paid.currency ?? '').toUpperCase();
  if (paidCurrency !== expected.currency.toUpperCase()) {
    return { ok: false, reason: 'currency', expected, paidCents, paidCurrency };
  }
  if (paidCents !== expected.amountCents && !(expected.alsoAcceptCents ?? []).includes(paidCents)) {
    return { ok: false, reason: 'amount', expected, paidCents, paidCurrency };
  }
  return { ok: true };
}

/** What a subscription's preapproval may charge: its plan's price (Pro
 *  Lealtad: any step of its schedule, each charge is gated against its own
 *  step in onLealtadCharge), or the tier's for rows older than plan keys. */
export function expectedChargeForPlan(
  planKey: PlanKey | null,
  tier: SubscriptionTier,
): ExpectedCharge | null {
  if (!planKey) return expectedChargeForTier(tier);
  return {
    amountCents: planPrice(planKey).totalCents,
    alsoAcceptCents:
      planKey === 'pro_lealtad' ? lealtadSchedule().map((s) => s.cents) : grandfatheredFor(planKey),
    currency: PRICING.currency,
    label: `plan ${planKey}`,
  };
}

/**
 * The price gate for a preapproval, decided BEFORE our copy is written: an
 * authorised preapproval whose amount doesn't match the plan is stored as
 * AMOUNT_MISMATCH_STATUS, never as 'authorized' (any authorised row grants
 * its tier).
 */
export function gatePreapproval(input: {
  status: string;
  planKey: PlanKey | null;
  tier: SubscriptionTier;
  amountMajor: number | null | undefined;
  currency: string | null | undefined;
}): { storedStatus: string; refused: false } | {
  storedStatus: typeof AMOUNT_MISMATCH_STATUS;
  refused: true;
  expected: ExpectedCharge | null;
} {
  if (input.status !== 'authorized') return { storedStatus: input.status, refused: false };
  const expected = expectedChargeForPlan(input.planKey, input.tier);
  const charge = expected
    ? checkCharge(expected, { amountMajor: input.amountMajor, currency: input.currency })
    : null;
  if (expected && charge?.ok) return { storedStatus: input.status, refused: false };
  return { storedStatus: AMOUNT_MISMATCH_STATUS, refused: true, expected };
}
