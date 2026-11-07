// What each Stripe event does to our side. Every handler re-reads the object from Stripe and
// lands on the same idempotent writers as Mercado Pago (subscription-sync, one-off-settlement).

import 'server-only';
import type Stripe from 'stripe';
import { getStripe } from './stripe';
import { applyRecurringCharge, syncSubscription } from './subscription-sync';
import { stripeInvoiceReport } from './stripe-subscription';
import { chargeFromPaymentIntent, type InvoiceEvent } from './stripe-mapping';
import { settleOneOffCharge } from './one-off-settlement';
import { parsePackReference } from './subscription-reference';
import { onChargebackOpened, onRefundReported } from '@/lib/billing/disputes-server';
import { finishStripeStartFromWebhook } from '@/lib/billing/start-subscription';

/** 500 = please retry (Stripe does, for days); 200 = done or nothing to do. */
export interface StripeEventResult {
  status: 200 | 500;
  body: Record<string, unknown>;
}

const done = (body: Record<string, unknown>): StripeEventResult => ({ status: 200, body });
const retry = (body: Record<string, unknown>): StripeEventResult => ({ status: 500, body });

const idOf = (v: string | { id: string } | null | undefined) =>
  !v ? null : typeof v === 'string' ? v : v.id;

export async function handleStripeEvent(event: Stripe.Event): Promise<StripeEventResult> {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      return syncAndFinish(event.data.object.id);
    case 'customer.subscription.deleted':
      return syncSub(event.data.object.id);
    case 'invoice.paid':
    case 'invoice.payment_failed':
    case 'invoice.payment_action_required':
      return invoiceEvent(event.data.object.id, event.type);
    case 'payment_intent.succeeded':
    case 'payment_intent.payment_failed':
      return packIntent(event.data.object.id);
    case 'charge.refunded':
      return chargeRefunded(event.data.object);
    case 'charge.dispute.created':
      return disputeOpened(event.data.object);
    default:
      return done({ ignored: event.type });
  }
}

async function syncSub(id: string): Promise<StripeEventResult> {
  const out = await syncSubscription(id);
  if (out.ok) return done({ ok: true, status: out.status, applied: out.applied });
  return out.retry ? retry({ error: out.reason }) : done({ ignored: out.reason });
}

async function syncAndFinish(id: string): Promise<StripeEventResult> {
  const out = await syncSub(id);
  if (out.status === 200 && out.body.status === 'authorized') {
    try {
      await finishStripeStartFromWebhook(id);
    } catch (err) {
      console.error('[stripe/webhook] start not finished, asking for a retry', id, err);
      return retry({ error: 'start not finished' });
    }
  }
  return out;
}

async function invoiceEvent(
  id: string | undefined,
  type: InvoiceEvent,
): Promise<StripeEventResult> {
  if (!id) return done({ ignored: 'invoice without id' });
  const report = await stripeInvoiceReport(id, type);
  if (!report) return done({ ignored: 'not a subscription invoice' });
  // A $0 invoice (a trial starting) moves no money: only the subscription changes.
  if (!report.paymentId) return syncSub(report.subscriptionId);
  // A start's own first charge failing is answered by the checkout itself: no grace, no
  // "your charge failed" mail, and never an end date on the plan the buyer already has.
  if (report.firstOfStart && report.status !== 'approved') return syncSub(report.subscriptionId);
  const out = await applyRecurringCharge(report);
  if (out.ok) return done({ ok: true });
  return out.retry
    ? retry({ error: 'recurring charge not applied' })
    : done({ ignored: 'not ours' });
}

async function packIntent(id: string): Promise<StripeEventResult> {
  const pi = await getStripe().paymentIntents.retrieve(id, { expand: ['latest_charge'] });
  // Subscription charges arrive as invoice.* events; only packs settle here.
  if (!parsePackReference(pi.metadata?.external_reference)) return done({ ignored: 'not a pack' });
  const settled = await settleOneOffCharge(
    chargeFromPaymentIntent(pi),
    pi as unknown as Record<string, unknown>,
  );
  return settled.httpStatus === 200 ? done(settled.body) : retry(settled.body);
}

async function chargeRefunded(charge: Stripe.Charge): Promise<StripeEventResult> {
  const piId = idOf(charge.payment_intent);
  if (!piId) return done({ ignored: 'charge without intent' });
  const pi = await getStripe().paymentIntents.retrieve(piId, { expand: ['latest_charge'] });
  const pack = parsePackReference(pi.metadata?.external_reference);
  // A whole pack refunded takes its unused credits back (Paquetes §7.2); anything else is
  // recorded for a person, and the plan never changes (Términos §7.3).
  if (pack && charge.refunded) {
    const settled = await settleOneOffCharge(
      chargeFromPaymentIntent(pi, 'refunded'),
      pi as unknown as Record<string, unknown>,
    );
    return settled.httpStatus === 200 ? done(settled.body) : retry(settled.body);
  }
  await onRefundReported({
    userId: pack?.userId ?? pi.metadata?.user_id ?? null,
    mpPaymentId: piId,
    amountMajor: charge.amount_refunded / 100,
  });
  return done({ ok: true, reversal: 'recorded' });
}

async function disputeOpened(dispute: Stripe.Dispute): Promise<StripeEventResult> {
  const piId = idOf(dispute.payment_intent);
  if (!piId) return done({ ignored: 'dispute without intent' });
  // A dispute changes nothing on the account (Términos §10.2): recorded and triaged.
  const opened = await onChargebackOpened({
    mpPaymentId: piId,
    mpStatus: 'charged_back',
    mpChargebackId: dispute.id,
  });
  return opened.ok
    ? done({ ok: true, dispute: true })
    : retry({ error: 'chargeback record failed' });
}
