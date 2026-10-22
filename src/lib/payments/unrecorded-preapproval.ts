import 'server-only';

// What a checkout does when it can't write the subscriptions row for a
// preapproval it just created. No refunds here: whether to refund is a
// separate decision.

import { notify } from '@/lib/notifications/notify';
import { cancelPreapproval } from './subscription-sync';

/** Already charged: keep the preapproval so the webhook sync can still build
 *  the row and grant the plan, and tell an admin to check it. */
export async function alertChargedWithoutRow(input: {
  userId: string;
  preapprovalId: string;
  source: string;
}): Promise<void> {
  await notify({
    severity: 'critical',
    title: 'Cobro sin fila de suscripción — revisa el plan en Mercado Pago',
    body: `usuario ${input.userId} · MP ${input.preapprovalId} · ya se cobró; el webhook intentará crear la fila y dar el plan`,
    href: '/dashboard/dinero',
    source: input.source,
  });
}

/** Nothing charged yet: cancel, and alert only when the cancel fails. */
export async function cancelUnchargedWithoutRow(input: {
  userId: string;
  preapprovalId: string;
  source: string;
}): Promise<void> {
  await cancelPreapproval(input.preapprovalId).catch(async (e) => {
    console.error('[billing] COULD NOT CANCEL preapproval without a row', input.preapprovalId, e);
    await notify({
      severity: 'critical',
      title: 'Preapproval vivo sin fila — cancélalo en Mercado Pago',
      body: `usuario ${input.userId} · MP ${input.preapprovalId}`,
      href: '/dashboard/dinero',
      source: input.source,
    });
  });
}
