'use server';

// Dinero → Disputas (WS-8). Each action re-checks the admin, does one step of
// aceptacion-ux §10.5 and lands in Actividad. Nothing here restricts an
// account: measures come only from the decision, and only with
// CHARGEBACK_MEASURES_ENABLED.

import { revalidatePath } from 'next/cache';
import { logAudit } from '@/lib/audit/log';
import { createAdminClient } from '@/lib/supabase/admin';
import { isRefundReason } from '@/lib/billing/disputes';
import {
  markLegalCase,
  recordPaid,
  recordResolution,
  recordResponse,
  sendChargebackNotice,
} from '@/lib/billing/disputes-server';
import { adminName, adminSession } from './guard';

export type DisputeStep =
  | { kind: 'resolved'; resolution: 'won' | 'lost' }
  | { kind: 'legal'; reason: string }
  | { kind: 'notice'; payUrl: string; medida: 'suspender' | 'cerrar' }
  | { kind: 'response'; accepted: boolean }
  | { kind: 'paid' };

export type DisputeActionResult =
  | { ok: true }
  | { ok: false; code: 'FORBIDDEN' | 'NOT_ALLOWED' | 'PAY_URL' | 'EMAIL' };

export async function disputeStep(id: string, step: DisputeStep): Promise<DisputeActionResult> {
  const actor = await adminSession();
  if (!actor) return { ok: false, code: 'FORBIDDEN' };
  const name = adminName(actor);
  const { data: cb } = await createAdminClient()
    .from('chargebacks')
    .select('user_id')
    .eq('id', id)
    .maybeSingle();
  if (!cb) return { ok: false, code: 'NOT_ALLOWED' };
  let done = false;
  switch (step.kind) {
    case 'resolved':
      if (step.resolution !== 'won' && step.resolution !== 'lost') break;
      done = await recordResolution(id, step.resolution, name);
      break;
    case 'legal':
      if (!isRefundReason(step.reason)) break;
      done = await markLegalCase(id, step.reason, name);
      break;
    case 'notice': {
      const r = await sendChargebackNotice(id, {
        actor: name,
        payUrl: step.payUrl || null,
        medida: step.medida === 'cerrar' ? 'cerrar' : 'suspender',
      });
      if (!r.ok)
        return {
          ok: false,
          code: r.code === 'PAY_URL' || r.code === 'EMAIL' ? r.code : 'NOT_ALLOWED',
        };
      done = true;
      break;
    }
    case 'response':
      done = await recordResponse(id, step.accepted === true, name);
      break;
    case 'paid':
      done = await recordPaid(id, name);
      break;
  }
  if (!done) return { ok: false, code: 'NOT_ALLOWED' };
  await logAudit({
    action: 'admin.dispute',
    actorId: actor.user.id,
    actorEmail: actor.user.email ?? null,
    targetUserId: cb.user_id as string,
    targetEmail: null,
    metadata: { chargeback_id: id, step: step.kind, admin_name: name },
  });
  revalidatePath('/[locale]/dashboard', 'layout');
  return { ok: true };
}
