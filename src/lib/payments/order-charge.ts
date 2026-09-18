// One shape for "somebody paid (or tried to)", whatever Mercado Pago API it
// came through. The webhook receives one-off payments two ways: the Payments
// API (`payment` topic, the legacy Checkout Pro preferences) and the Orders
// API (`orders` topic, Checkout Pro via Orders, which is what the token pack
// checkout creates today). Both are reduced to this before anything is
// recorded or granted, so the settlement logic exists once. Pure, no I/O.

import { createHash } from 'node:crypto';

/** Status vocabulary the settlement understands. It is the Payments API's,
 *  because that is what `payments.status` and /app/billing already speak. */
export type ChargeStatus =
  | 'approved'
  | 'pending'
  | 'in_process'
  | 'rejected'
  | 'cancelled'
  | 'refunded'
  | 'charged_back'
  | 'unknown';

export interface NormalizedCharge {
  /** Which API the charge came from, for logs and the audit trail. */
  source: 'payment' | 'order';
  /** The id that keys the `payments` ledger (UNIQUE). For an order it is the
   *  id of its payment when Mercado Pago has one, else the order id. */
  mpPaymentId: string;
  /** The id to quote to humans and to Mercado Pago support. */
  mpReference: string;
  status: ChargeStatus;
  /**
   * THE AMOUNT THE ENTITLEMENT IS GATED ON, in major units (749.00).
   *
   * For an order this is `total_amount`: the price of what was sold, which
   * we set from the catalog and Mercado Pago echoes back. It is never
   * `total_paid_amount`, which can include installment interest, fees or
   * rounding Mercado Pago adds on top and would make a correctly priced
   * pack look "wrong" (or, worse, let a different total pass). For a
   * Payments API payment it is `transaction_amount`. null when unknown.
   */
  amountMajor: number | null;
  /** What Mercado Pago says actually moved (`total_paid_amount`). For the
   *  ledger and humans only — never for deciding what to grant. */
  paidAmountMajor: number | null;
  currency: string | null;
  externalReference: string;
}

/** Minimal view of GET /v1/orders/{id}. Only what the settlement reads. */
export interface OrderLike {
  id?: string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  total_amount?: string;
  total_paid_amount?: string;
  currency?: string;
  transactions?: {
    payments?: Array<{ id?: string; status?: string; amount?: string; paid_amount?: string }>;
  };
}

/** Minimal view of GET /v1/payments/{id}. */
export interface PaymentLike {
  id?: number | string;
  status?: string;
  external_reference?: string;
  transaction_amount?: number;
  currency_id?: string;
}

/**
 * Orders API → Payments API status. An order is `processed` once its money
 * is in; `created` and `action_required` are still waiting on the buyer;
 * `expired` and `canceled` will never be paid; `failed` was tried and
 * refused.
 */
export function orderStatusToChargeStatus(status: string | null | undefined): ChargeStatus {
  switch ((status ?? '').trim().toLowerCase()) {
    case 'processed':
      return 'approved';
    case 'created':
    case 'action_required':
    case 'at_terminal':
      return 'pending';
    case 'canceled':
    case 'cancelled':
    case 'expired':
      return 'cancelled';
    case 'failed':
      return 'rejected';
    case 'refunded':
      return 'refunded';
    default:
      return 'unknown';
  }
}

/** Payments API statuses pass through; anything unexpected is `unknown`. */
export function paymentStatusToChargeStatus(status: string | null | undefined): ChargeStatus {
  const s = (status ?? '').trim().toLowerCase();
  switch (s) {
    case 'approved':
    case 'pending':
    case 'in_process':
    case 'rejected':
    case 'cancelled':
    case 'refunded':
    case 'charged_back':
      return s;
    default:
      return 'unknown';
  }
}

function toAmount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function chargeFromOrder(order: OrderLike): NormalizedCharge {
  const orderId = order.id ?? '';
  const payment = order.transactions?.payments?.[0];
  const status = orderStatusToChargeStatus(order.status);
  return {
    source: 'order',
    mpPaymentId: payment?.id ? String(payment.id) : orderId,
    mpReference: orderId,
    status,
    // Authoritative: the order's total, i.e. the catalog price we sent.
    amountMajor: toAmount(order.total_amount),
    paidAmountMajor: toAmount(order.total_paid_amount),
    currency: order.currency ?? null,
    externalReference: order.external_reference ?? '',
  };
}

export function chargeFromPayment(payment: PaymentLike, fallbackId: string): NormalizedCharge {
  const id = String(payment.id ?? fallbackId);
  const amount = toAmount(payment.transaction_amount);
  return {
    source: 'payment',
    mpPaymentId: id,
    mpReference: id,
    status: paymentStatusToChargeStatus(payment.status),
    amountMajor: amount,
    paidAmountMajor: amount,
    currency: payment.currency_id ?? null,
    externalReference: payment.external_reference ?? '',
  };
}

/** A charge Mercado Pago has reversed: the buyer got the money back. */
export function isReversal(status: ChargeStatus): boolean {
  return status === 'refunded' || status === 'charged_back';
}

// ── Idempotency ──────────────────────────────────────────────────────────

/** How long two attempts count as the same purchase. A buyer who clicks
 *  twice, or a server function retried by the framework, lands in the same
 *  bucket and gets the same order back instead of a second payable one. */
export const ORDER_IDEMPOTENCY_BUCKET_MS = 10 * 60 * 1000;

/**
 * X-Idempotency-Key for creating a pack order: STABLE for the same user,
 * pack and ten-minute window, so a retry of the same logical purchase
 * reuses the order Mercado Pago already created. A random key per attempt
 * would do the opposite. Hashed so the header carries no user id.
 */
export function orderIdempotencyKey(input: {
  userId: string;
  packId: string;
  /** 'card' (Brick, automatic order) or 'hosted' (checkout_url). Different
   *  bodies must not share a key. */
  mode: 'card' | 'hosted';
  now?: Date;
  bucketMs?: number;
}): string {
  const bucketMs = input.bucketMs ?? ORDER_IDEMPOTENCY_BUCKET_MS;
  const bucket = Math.floor((input.now ?? new Date()).getTime() / bucketMs);
  const logical = `pack|${input.userId}|${input.packId}|${input.mode}|${bucket}`;
  return sha256Hex(logical);
}

function sha256Hex(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

// ── Hosted checkout redirect ─────────────────────────────────────────────

const ALLOWED_CHECKOUT_HOSTS = new Set([
  'mercadopago.com',
  'www.mercadopago.com',
  'mercadopago.com.mx',
  'www.mercadopago.com.mx',
]);

/**
 * The only place a browser is ever sent from a pack purchase is Mercado
 * Pago's own checkout. `checkout_url` comes from their API, but the browser
 * navigates wherever the server function says, so the server function
 * checks the host before handing it back. HTTPS only.
 */
export function isAllowedCheckoutUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  return ALLOWED_CHECKOUT_HOSTS.has(parsed.hostname.toLowerCase());
}

/** "1000.00" — the Orders API takes amounts as strings with two decimals. */
export function orderAmount(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}

// ── external_reference ───────────────────────────────────────────────────
//
// The reference is how a notification finds the buyer and what they bought;
// nothing else on the order says it. The Orders API validates it against a
// pattern and rejects `|`:
//
//   Invalid value for property (property_value) · '$.external_reference'
//   - does not match pattern
//
// which is what made every card charge fail. So a pack reference is now
// built from `-` alone, which every shape of the pattern allows:
//
//   pack-<uuid>-<pack id with _ as ->    pack-3f2a…cde-tokens-100k
//
// The user id stays readable, so the reference is still meaningful in
// Mercado Pago's own panel. Parsing accepts the old `|` forms too: orders
// and preferences created before this change are still out there, and a
// notification for one must settle exactly as it always did.
//
// Subscriptions keep their "sub|<userId>|<TIER>" reference: the preapproval
// API takes it (its validation is what answered CC_VAL_433, well past the
// schema), and changing a format that works would put live plans at risk
// for nothing. See subscription-reference.ts.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A pack id as it appears inside a reference: `_` is not in the Orders
 *  API's alphabet, `-` is. */
function packSlug(packId: string): string {
  return packId.replace(/_/g, '-');
}

/** external_reference for a token pack order: "pack-<userId>-<slug>". */
export function packReference(userId: string, packId: string): string {
  return `pack-${userId}-${packSlug(packId)}`;
}

export type ParsedOneOffReference =
  | { kind: 'pack'; userId: string; packId: string }
  /** The one-off tier purchase the hub sold before subscriptions existed. */
  | { kind: 'tier'; userId: string; tier: string }
  | null;

/**
 * Who paid and for what, from the reference on an order or a payment.
 *
 * `knownPackIds` is the list to resolve a slug against — the pack ids are
 * the only authority on where a `-` in the slug was once a `_`, and passing
 * them in keeps this module free of the pricing table.
 */
export function parseOneOffReference(
  ref: string | null | undefined,
  knownPackIds: readonly string[],
): ParsedOneOffReference {
  const value = (ref ?? '').trim();
  if (!value) return null;

  // Current form: pack-<uuid>-<slug>
  if (value.startsWith('pack-')) {
    const rest = value.slice('pack-'.length);
    const userId = rest.slice(0, 36);
    if (!UUID_RE.test(userId) || rest[36] !== '-') return null;
    const slug = rest.slice(37);
    if (!slug) return null;
    const packId = knownPackIds.find((id) => packSlug(id) === slug);
    return packId ? { kind: 'pack', userId, packId } : null;
  }

  // Legacy forms, still arriving for anything created before the change.
  const parts = value.split('|');
  if (parts[0] === 'pack') {
    const [, userId, packId] = parts;
    if (parts.length !== 3 || !userId || !packId) return null;
    return knownPackIds.includes(packId) ? { kind: 'pack', userId, packId } : null;
  }
  if (parts.length === 2) {
    const [userId, tier] = parts;
    if (!userId || !tier) return null;
    return { kind: 'tier', userId, tier };
  }
  return null;
}
