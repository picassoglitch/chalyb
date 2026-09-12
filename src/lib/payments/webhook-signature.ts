// Mercado Pago webhook signature verification.
//
// Pure module on purpose — it takes the header strings and the secret as
// arguments and returns a verdict, so the rule is unit-testable without a
// Request, a network, or env vars. The route handler does the plumbing.
//
// WHY THIS FILE EXISTS AT ALL
// The first version of this check lived inline in the route and started
// with:
//
//     const secret = getWebhookSecret();
//     if (!secret) return true;   // "not configured = skip verification"
//
// That is fail-OPEN. /api/mp/webhook is a public, unauthenticated endpoint
// whose whole job is to hand out paid tiers and token packs. With the
// secret unset — a single missing Vercel env var — anyone who can POST a
// JSON body could mint themselves VIP. The verdict below is fail-CLOSED:
// no secret means no verification is possible, which means the request
// cannot be trusted, which means reject.
//
// THE ONE ESCAPE HATCH
// Local development against MP's sandbox through a tunnel is genuinely
// easier without the secret, so an explicit opt-in
// (MP_ALLOW_UNSIGNED_WEBHOOK=true) skips verification — but ONLY when
// NODE_ENV is not 'production'. The flag is inert in production by
// construction, so leaving it set in a .env file that reaches Vercel
// cannot reopen the hole.

import { createHmac, timingSafeEqual } from 'node:crypto';

export type SignatureVerdict =
  | { ok: true; reason: 'verified' | 'dev_unsigned_allowed' }
  | {
      ok: false;
      reason: 'secret_missing' | 'header_missing' | 'header_malformed' | 'mismatch';
      /** Safe to log; never contains the secret or the presented signature. */
      detail: string;
    };

export interface SignatureInput {
  /** MERCADOPAGO_WEBHOOK_SECRET, or undefined when unset. */
  secret: string | undefined;
  /** Raw `x-signature` header: "ts=1733520000,v1=abc123…". */
  signatureHeader: string | null;
  /** Raw `x-request-id` header — part of the signed manifest. */
  requestId: string | null;
  /** `data.id` from the webhook body. */
  paymentId: string;
  /** process.env.NODE_ENV at call time. */
  nodeEnv: string | undefined;
  /** process.env.MP_ALLOW_UNSIGNED_WEBHOOK at call time. */
  allowUnsignedFlag: string | undefined;
}

/**
 * MP signs the webhook with HMAC-SHA256 over the manifest string:
 *   `id:${data.id};request-id:${x-request-id};ts:${ts};`
 * where ts comes out of the x-signature header itself.
 * https://www.mercadopago.com/developers/en/docs/your-integrations/notifications/webhooks
 */
export function verifyMercadoPagoSignature(input: SignatureInput): SignatureVerdict {
  const { secret, signatureHeader, requestId, paymentId, nodeEnv, allowUnsignedFlag } = input;

  if (!secret) {
    const isProduction = nodeEnv === 'production';
    if (!isProduction && allowUnsignedFlag === 'true') {
      return { ok: true, reason: 'dev_unsigned_allowed' };
    }
    return {
      ok: false,
      reason: 'secret_missing',
      detail: isProduction
        ? 'MERCADOPAGO_WEBHOOK_SECRET is unset in production — refusing every webhook until it is configured.'
        : 'MERCADOPAGO_WEBHOOK_SECRET is unset. Set it, or set MP_ALLOW_UNSIGNED_WEBHOOK=true for local development only.',
    };
  }

  if (!signatureHeader || !requestId) {
    return {
      ok: false,
      reason: 'header_missing',
      detail: 'x-signature and/or x-request-id absent',
    };
  }

  const parts: Record<string, string> = {};
  for (const chunk of signatureHeader.split(',')) {
    const eq = chunk.indexOf('=');
    if (eq === -1) continue;
    const key = chunk.slice(0, eq).trim();
    const value = chunk.slice(eq + 1).trim();
    if (key) parts[key] = value;
  }

  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) {
    return { ok: false, reason: 'header_malformed', detail: 'x-signature missing ts or v1' };
  }

  const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest();

  let presented: Buffer;
  try {
    presented = Buffer.from(v1, 'hex');
  } catch {
    return { ok: false, reason: 'header_malformed', detail: 'v1 is not hex' };
  }
  // timingSafeEqual throws on a length mismatch, which itself leaks the
  // comparison — check the length first and treat it as a plain mismatch.
  if (presented.length !== expected.length) {
    return { ok: false, reason: 'mismatch', detail: 'signature length mismatch' };
  }
  if (!timingSafeEqual(expected, presented)) {
    return { ok: false, reason: 'mismatch', detail: 'signature does not match' };
  }

  return { ok: true, reason: 'verified' };
}
