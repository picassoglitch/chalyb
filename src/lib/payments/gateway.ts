// Operations on an existing subscription or charge, routed to whichever gateway owns the id.
// Rows keep their gateway for life, so a switch of PAYMENTS_PROVIDER never strands one.

import 'server-only';
import { getMercadoPago, getMercadoPagoIsolated } from './mercadopago';
import { isStripePaymentId, isStripeSubscriptionId } from './stripe-config';
import {
  holdStripeCharges,
  refundStripePayment,
  setStripeRecurringAmount,
} from './stripe-subscription';

export function gatewayName(id: string): 'Stripe' | 'Mercado Pago' {
  return isStripeSubscriptionId(id) || isStripePaymentId(id) ? 'Stripe' : 'Mercado Pago';
}

/** Refund `cents` of one charge. Throws if the gateway refuses. */
export async function refundPayment(
  paymentId: string,
  cents: number,
  idempotencyKey?: string,
): Promise<void> {
  if (isStripePaymentId(paymentId)) return refundStripePayment(paymentId, cents, idempotencyKey);
  const mp = idempotencyKey ? getMercadoPagoIsolated() : getMercadoPago();
  await mp.refund.create({
    payment_id: paymentId,
    body: { amount: cents / 100 },
    ...(idempotencyKey ? { requestOptions: { idempotencyKey } } : {}),
  });
}

/** No charge before `until`. True only when the gateway confirms it. */
export async function holdCharges(subscriptionId: string, until: Date): Promise<boolean> {
  if (isStripeSubscriptionId(subscriptionId)) return holdStripeCharges(subscriptionId, until);
  const { preapproval } = getMercadoPago();
  try {
    await preapproval.update({ id: subscriptionId, body: { status: 'paused' } });
    const mp = await preapproval.get({ id: subscriptionId });
    return mp.status === 'paused';
  } catch (err) {
    console.error('[cron/billing] pause for a notice hold failed', subscriptionId, err);
    return false;
  }
}

/** Undo a hold. A Stripe hold moved the billing date and ends by itself: nothing to resume. */
export async function resumeCharges(subscriptionId: string): Promise<void> {
  if (isStripeSubscriptionId(subscriptionId)) return;
  await getMercadoPago().preapproval.update({
    id: subscriptionId,
    body: { status: 'authorized' },
  });
}

/** The amount of the next charges (a price change accepted, a Lealtad step). */
export async function setRecurringAmount(subscriptionId: string, cents: number): Promise<void> {
  if (isStripeSubscriptionId(subscriptionId)) {
    return setStripeRecurringAmount(subscriptionId, cents);
  }
  await getMercadoPago().preapproval.update({
    id: subscriptionId,
    body: { auto_recurring: { transaction_amount: cents / 100, currency_id: 'MXN' } },
  } as never);
}
