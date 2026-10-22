import 'server-only';

// What a checkout does when it can't write the subscriptions row for a
// preapproval it just created. No refunds here: whether to refund is a
// separate decision.

import { notify } from '@/lib/notifications/notify';
import { cancelPreapproval } from './subscription-sync';

/** Already charged, no checkout row. `fallback`: what the sync's row from
 *  Mercado Pago did. Every case needs a human to verify it. */
export async function alertChargedWithoutRow(input: {
  userId: string;
  preapprovalId: string;
  planKey: string;
  fallback: 'granted' | 'row_only' | 'failed';
  source: string;
}): Promise<void> {
  const what = {
    granted: {
      title: 'Cobro sin fila de checkout — plan dado desde Mercado Pago, verifícalo',
      body: 'plan activo; falta la evidencia de consentimiento en la fila',
    },
    row_only: {
      title: 'Cobro sin fila de checkout — fila creada, plan aún no activo, verifícalo',
      body: 'fila creada desde Mercado Pago; el plan se activa cuando MP lo autorice',
    },
    failed: {
      title: 'Cobro sin plan — da el plan y verifícalo a mano',
      body: 'no hay fila ni plan',
    },
  }[input.fallback];
  await notify({
    severity: 'critical',
    title: what.title,
    body: `usuario ${input.userId} · MP ${input.preapprovalId} · plan ${input.planKey} · ya se cobró; ${what.body}`,
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
