// Stripe objects → the provider-neutral shapes subscription-sync.ts and the ledger apply.
// Pure (types only), so every mapping is unit-tested without the SDK.

import type Stripe from 'stripe';
import type { PreapprovalStatus } from './subscription-reference';
import type { ChargeStatus, NormalizedCharge } from './order-charge';
import { paymentIntentToChargeStatus, stripeStatusToPreapproval } from './stripe-config';

/** What a gateway says about one subscription, in the preapproval vocabulary. */
export interface SubscriptionSnapshot {
  id: string;
  provider: 'mercadopago' | 'stripe';
  externalReference: string | null | undefined;
  status: PreapprovalStatus;
  nextPaymentDate: string | null;
  amountMajor: number | undefined;
  currency: string | undefined;
  dateCreated: string | undefined;
  /** The gateway's own record of its last successful charge. */
  lastChargedAt: string | null;
  lastChargedAmountMajor: number | null;
  /** Never paid nor trialed: its end must not cut access something else granted. */
  neverActivated?: boolean;
  raw: Record<string, unknown>;
}

/** One recurring charge attempt (an MP authorized_payment, a Stripe invoice). */
export interface RecurringChargeReport {
  provider: 'mercadopago' | 'stripe';
  /** Ledger key; null when nothing was tried yet. */
  paymentId: string | null;
  subscriptionId: string;
  externalReference: string | null | undefined;
  amountMajor: number;
  currency: string;
  status: ChargeStatus;
  chargedAt: string;
  retryAttempt: number;
  nextRetryDate: string | null;
  raw: Record<string, unknown>;
  /** Stripe: the first invoice of a new subscription (billing_reason subscription_create). */
  firstOfStart?: boolean;
}

const iso = (s: number | null | undefined) =>
  typeof s === 'number' && s > 0 ? new Date(s * 1000).toISOString() : null;

const idOf = (v: string | { id: string } | null | undefined) =>
  !v ? null : typeof v === 'string' ? v : v.id;

/** The subscription a (new-API) invoice belongs to. */
export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  return idOf(invoice.parent?.subscription_details?.subscription ?? null);
}

export function snapshotFromStripe(sub: Stripe.Subscription): SubscriptionSnapshot {
  const item = sub.items?.data?.[0];
  const unit = item?.price?.unit_amount;
  // A trial without its card yet (setup not confirmed) is not authorised to anything.
  const cardless = !sub.default_payment_method;
  const status =
    sub.status === 'trialing' && cardless
      ? 'pending'
      : stripeStatusToPreapproval(sub.status, !!sub.pause_collection);
  const periodEnd = Math.min(
    ...(sub.items?.data ?? []).map((i) => i.current_period_end).filter((n) => n > 0),
  );
  const nextPaymentDate =
    sub.status === 'trialing' && sub.trial_end
      ? iso(sub.trial_end)
      : sub.status === 'incomplete' || sub.status === 'incomplete_expired'
        ? null
        : iso(Number.isFinite(periodEnd) ? periodEnd : null);
  const invoice = typeof sub.latest_invoice === 'object' ? sub.latest_invoice : null;
  const paidAt =
    invoice && invoice.status === 'paid' && invoice.amount_paid > 0
      ? iso(invoice.status_transitions?.paid_at ?? invoice.created)
      : null;
  return {
    id: sub.id,
    provider: 'stripe',
    externalReference: sub.metadata?.external_reference ?? null,
    status,
    nextPaymentDate,
    amountMajor: typeof unit === 'number' ? unit / 100 : undefined,
    currency: (item?.price?.currency ?? sub.currency)?.toUpperCase(),
    dateCreated: iso(sub.created) ?? undefined,
    lastChargedAt: paidAt,
    lastChargedAmountMajor: paidAt && invoice ? invoice.amount_paid / 100 : null,
    neverActivated:
      sub.status === 'incomplete' || sub.status === 'incomplete_expired' || (cardless && !paidAt),
    raw: sub as unknown as Record<string, unknown>,
  };
}

export type InvoiceEvent =
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'invoice.payment_action_required';

/** An invoice event as a recurring charge. $0 invoices (trial start) carry no payment. */
export function chargeReportFromInvoice(
  invoice: Stripe.Invoice,
  event: InvoiceEvent,
  paymentIntentId: string | null,
): RecurringChargeReport | null {
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return null;
  const meta = invoice.parent?.subscription_details?.metadata ?? null;
  const total = event === 'invoice.paid' ? invoice.amount_paid : invoice.amount_due;
  const status: ChargeStatus = event === 'invoice.paid' ? 'approved' : 'rejected';
  return {
    provider: 'stripe',
    paymentId: total > 0 ? (paymentIntentId ?? invoice.id ?? null) : null,
    subscriptionId,
    externalReference: meta?.external_reference ?? null,
    amountMajor: total / 100,
    currency: (invoice.currency ?? 'mxn').toUpperCase(),
    status,
    chargedAt:
      iso(event === 'invoice.paid' ? invoice.status_transitions?.paid_at : null) ??
      iso(invoice.created) ??
      new Date().toISOString(),
    retryAttempt: Math.max(0, (invoice.attempt_count ?? 1) - 1),
    nextRetryDate: iso(invoice.next_payment_attempt),
    raw: invoice as unknown as Record<string, unknown>,
    firstOfStart: invoice.billing_reason === 'subscription_create',
  };
}

/** A pack PaymentIntent as the one-off settlement's charge. */
export function chargeFromPaymentIntent(
  pi: Stripe.PaymentIntent,
  override?: ChargeStatus,
): NormalizedCharge {
  const refunded =
    typeof pi.latest_charge === 'object' && pi.latest_charge?.refunded ? 'refunded' : null;
  return {
    source: 'stripe',
    mpPaymentId: pi.id,
    mpReference: pi.id,
    status: override ?? refunded ?? paymentIntentToChargeStatus(pi.status),
    amountMajor: typeof pi.amount === 'number' ? pi.amount / 100 : null,
    paidAmountMajor: typeof pi.amount_received === 'number' ? pi.amount_received / 100 : null,
    currency: pi.currency ? pi.currency.toUpperCase() : null,
    externalReference: pi.metadata?.external_reference ?? '',
  };
}

/** The decline code Stripe gave for a failed intent, for the buyer's message. */
export function declineCodeOf(
  err: { decline_code?: string | null; code?: string | null } | null | undefined,
): string | null {
  return err?.decline_code || err?.code || null;
}
