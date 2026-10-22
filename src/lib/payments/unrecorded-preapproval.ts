import 'server-only';

// What a checkout does when it can't write the subscriptions row for a
// preapproval it just created. No refunds here: whether to refund is a
// separate decision.

import { notify } from '@/lib/notifications/notify';
import { cancelPreapproval } from './subscription-sync';

/** Already charged, no checkout row: `granted` says whether the fallback row
 *  from Mercado Pago put the plan on. Either way a human verifies it. */
export async function alertChargedWithoutRow(input: {
  userId: string;
  preapprovalId: string;
  planKey: string;
  granted: boolean;
  source: string;
}): Promise<void> {
  await notify({
    severity: 'critical',
    title: input.granted
      ? 'Cobro sin fila de checkout — plan dado desde Mercado Pago, verifícalo'
      : 'Cobro sin plan — da el plan y verifícalo a mano',
    body: `usuario ${input.userId} · MP ${input.preapprovalId} · plan ${input.planKey} · ya se cobró${input.granted ? '; falta la evidencia de consentimiento en la fila' : '; no hay fila ni plan'}`,
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
