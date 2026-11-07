// Stripe-side operations on a running subscription or charge: read, cancel, hold, re-price,
// refund. subscription-sync.ts dispatches here when the id is a Stripe one (sub_, pi_, in_).

import 'server-only';
import type Stripe from 'stripe';
import { getStripe } from './stripe';
import {
  chargeReportFromInvoice,
  invoiceSubscriptionId,
  snapshotFromStripe,
  type RecurringChargeReport,
  type SubscriptionSnapshot,
} from './stripe-mapping';

export async function stripeSubscriptionSnapshot(id: string): Promise<SubscriptionSnapshot> {
  const sub = await getStripe().subscriptions.retrieve(id, { expand: ['latest_invoice'] });
  return snapshotFromStripe(sub);
}

/** The invoice behind an invoice.* event, read back from Stripe (never the payload alone). */
export async function stripeInvoiceReport(
  invoiceId: string,
): Promise<RecurringChargeReport | null> {
  const stripe = getStripe();
  const invoice = await stripe.invoices.retrieve(invoiceId, { expand: ['payments'] });
  const report = chargeReportFromInvoice(invoice, invoicePaymentIntent(invoice));
  if (report && !report.externalReference) {
    const subId = invoiceSubscriptionId(invoice);
    if (subId) {
      const sub = await stripe.subscriptions.retrieve(subId);
      report.externalReference = sub.metadata?.external_reference ?? null;
    }
  }
  return report;
}

function invoicePaymentIntent(invoice: Stripe.Invoice): string | null {
  for (const p of invoice.payments?.data ?? []) {
    const pi = p.payment?.payment_intent;
    if (pi) return typeof pi === 'string' ? pi : pi.id;
  }
  return null;
}

const ENDED = new Set(['canceled', 'incomplete_expired']);

/** Stops all future charges now, like an MP preapproval cancel. Throws if Stripe refuses. */
export async function cancelStripeSubscription(id: string): Promise<void> {
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(id);
  if (ENDED.has(sub.status)) return;
  await stripe.subscriptions.cancel(id, { prorate: false, invoice_now: false });
}

/** No charge before `until`: the billing date moves there (trial_end, no proration) and
 *  Stripe charges on its own then. True only when Stripe confirms the new date. */
export async function holdStripeCharges(id: string, until: Date): Promise<boolean> {
  const target = Math.ceil(until.getTime() / 1000);
  try {
    const sub = await getStripe().subscriptions.update(id, {
      trial_end: target,
      proration_behavior: 'none',
    });
    return (sub.trial_end ?? 0) >= target;
  } catch (err) {
    console.error('[stripe] hold failed', id, err);
    return false;
  }
}

/** The next charges at `cents`, same product and interval; nothing is prorated. */
export async function setStripeRecurringAmount(id: string, cents: number): Promise<void> {
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(id);
  const item = sub.items.data[0];
  if (!item) throw new Error(`stripe subscription ${id} has no item`);
  const product =
    typeof item.price.product === 'string' ? item.price.product : item.price.product.id;
  await stripe.subscriptions.update(id, {
    items: [
      {
        id: item.id,
        price_data: {
          currency: item.price.currency,
          product,
          unit_amount: cents,
          tax_behavior: 'inclusive',
          recurring: { interval: item.price.recurring?.interval ?? 'month' },
        },
      },
    ],
    proration_behavior: 'none',
  });
}

/** Refund part or all of a Stripe payment (a pi_ id; an in_ id is resolved to its intent). */
export async function refundStripePayment(
  paymentId: string,
  cents: number,
  idempotencyKey?: string,
): Promise<void> {
  const stripe = getStripe();
  let intent = paymentId;
  if (paymentId.startsWith('in_')) {
    const invoice = await stripe.invoices.retrieve(paymentId, { expand: ['payments'] });
    const pi = invoicePaymentIntent(invoice);
    if (!pi) throw new Error(`invoice ${paymentId} has no payment intent to refund`);
    intent = pi;
  }
  await stripe.refunds.create(
    { payment_intent: intent, amount: cents, reason: 'requested_by_customer' },
    idempotencyKey ? { idempotencyKey } : undefined,
  );
}
