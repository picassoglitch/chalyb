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
import type { SubscriptionTier } from '@/lib/auth/session';

export type SignatureFailure =
  | 'not_configured'
  | 'missing_headers'
  | 'malformed_signature'
  | 'mismatch';

export type SignatureCheck = { ok: true } | { ok: false; reason: SignatureFailure };

/**
 * MP signs the webhook with HMAC-SHA256 over the manifest
 *   `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * where ts comes out of the x-signature header itself.
 * https://www.mercadopago.com/developers/en/docs/your-integrations/notifications/webhooks
 */
export function checkMpSignature(opts: {
  secret: string | undefined | null;
  paymentId: string;
  requestId: string | null;
  signatureHeader: string | null;
}): SignatureCheck {
  const secret = opts.secret?.trim();
  // No secret configured → we cannot tell MP from anyone else on the internet.
  // The only safe answer is no.
  if (!secret) return { ok: false, reason: 'not_configured' };

  if (!opts.signatureHeader || !opts.requestId) {
    return { ok: false, reason: 'missing_headers' };
  }

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

  const manifest = `id:${opts.paymentId};request-id:${opts.requestId};ts:${ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(v1, 'hex');
    // timingSafeEqual throws on a length mismatch; a wrong-length digest is a
    // mismatch either way.
    if (a.length !== b.length) return { ok: false, reason: 'mismatch' };
    return timingSafeEqual(a, b) ? { ok: true } : { ok: false, reason: 'mismatch' };
  } catch {
    return { ok: false, reason: 'mismatch' };
  }
}

export interface ExpectedCharge {
  amountCents: number;
  currency: string;
  /** What is being bought, for logs and audit metadata. */
  label: string;
}

/** What a tier upgrade must cost. null = this tier is not for sale (FREE has
 *  no price, PARTNER is admin-granted), so no payment can ever grant it. */
export function expectedChargeForTier(tier: SubscriptionTier): ExpectedCharge | null {
  const price = TIER_PRICING[tier];
  if (!price) return null;
  return { amountCents: price.amountCents, currency: price.currency, label: `tier ${tier}` };
}

/** What a token pack must cost. null = unknown pack id. */
export function expectedChargeForPack(packId: string): ExpectedCharge | null {
  const pack = getTokenPack(packId);
  if (!pack) return null;
  return {
    amountCents: pack.amountCents,
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
 * Exact match on both, because the amount MP reports is the amount WE put on
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
  if (paidCents !== expected.amountCents) {
    return { ok: false, reason: 'amount', expected, paidCents, paidCurrency };
  }
  return { ok: true };
}
