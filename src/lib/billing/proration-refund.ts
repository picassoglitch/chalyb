// The unused part of the old period, refunded when a change applies now (plan-change.ts).
// Shared by an inline change and a Stripe change finished after 3DS.

import 'server-only';
import { notify } from '@/lib/notifications/notify';
import { refundPayment } from '@/lib/payments/gateway';

export async function refundProration(input: {
  paymentId: string;
  cents: number;
  planKey: string;
  /** Stable per change: a retried call can never refund twice at the gateway. */
  idempotencyKey: string;
}): Promise<void> {
  if (input.cents <= 0) return;
  try {
    await refundPayment(input.paymentId, input.cents, input.idempotencyKey);
  } catch (err) {
    // The upgrade stands; the refund goes to the admin's attention list.
    console.error(
      '[billing/change] proration refund failed — refund by hand',
      input.paymentId,
      input.cents,
      err,
    );
    await notify({
      severity: 'critical',
      title: 'Reembolso de prorrateo fallido — reembolsar a mano',
      body: `Pago ${input.paymentId} · ${(input.cents / 100).toFixed(2)} MXN · cambio a ${input.planKey}`,
      href: '/dashboard/dinero',
      source: 'billing.change',
    });
  }
}
