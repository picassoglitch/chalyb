'use server';

// Admin-only server actions for finalizing royalty periods + recording
// actual payments offline.
//
// The platform doesn't auto-pay partners. Workflow:
//   1. Admin visits /dashboard/royalties at end of month.
//   2. Reviews accruals (computed live from usage_events).
//   3. Clicks "Finalize period" → snapshots accruals into
//      engine_royalty_payouts rows (status='pending').
//   4. Pays partners offline (bank transfer, MP one-shot, etc).
//   5. Comes back, clicks "Mark paid" on each row + pastes the
//      payment_reference.
//
// Two reasons for the manual loop: (a) low volume, premature to automate;
// (b) keeps a human-in-the-loop on real money moving so a bad rate
// configuration doesn't ship money before someone notices.

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/auth/session';
import { isAdminRole } from '@/lib/billing/tiers';
import { logAudit } from '@/lib/audit/log';
import { getCurrentPeriodAccruals } from './royalties';

interface ActionResult {
  ok: boolean;
  error?: string;
  /** When non-null, summary the page can show after finalize. */
  finalized?: {
    created: number;
    totalAmountCents: number;
    skipped: number;
  };
}

/** Snapshot the current period's accruals into engine_royalty_payouts.
 *  Idempotent on (engine_id, period_start) — re-running adds payouts for
 *  any new engines that started accruing since the last finalize. */
export async function finalizeCurrentPeriod(): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'No autenticado' };
  if (!isAdminRole(session.role)) {
    return { ok: false, error: 'Solo admins pueden finalizar pagos' };
  }

  const summary = await getCurrentPeriodAccruals();
  const admin = createAdminClient();

  // Insert only engines that have a non-zero accrual AND aren't already
  // finalized for this period. The UNIQUE constraint on
  // (engine_id, period_start) would block double-inserts at the SQL
  // level, but we filter here first so the inserted count is meaningful.
  const toInsert = summary.accruals
    .filter((a) => a.accruedCents > 0 && !a.alreadyFinalized)
    .map((a) => ({
      engine_id: a.engineId,
      partner_user_id: a.partnerUserId,
      period_start: summary.periodStart,
      tokens_attributed: a.tokensThisPeriod,
      amount_cents: a.accruedCents,
      rate_per_million_cents_at_finalize: a.ratePerMillionCents,
      status: 'pending' as const,
    }));

  if (toInsert.length === 0) {
    return {
      ok: true,
      finalized: { created: 0, totalAmountCents: 0, skipped: summary.accruals.length },
    };
  }

  const { data, error } = await admin
    .from('engine_royalty_payouts')
    .insert(toInsert)
    .select('id, amount_cents');
  if (error) {
    return { ok: false, error: error.message };
  }

  const totalAmount = (data ?? []).reduce(
    (sum, r) => sum + ((r.amount_cents as number | null) ?? 0),
    0,
  );

  await logAudit({
    action: 'partner.engine_assign', // closest existing verb; royalty audit
    actorId: session.user.id,
    actorEmail: session.user.email ?? null,
    targetUserId: session.user.id,
    targetEmail: session.user.email ?? null,
    before: {},
    after: {
      period_start: summary.periodStart,
      payouts_created: toInsert.length,
      total_amount_cents: totalAmount,
    },
    metadata: { via: 'royalties_finalize_period' },
  });

  revalidatePath('/[locale]', 'layout');

  return {
    ok: true,
    finalized: {
      created: toInsert.length,
      totalAmountCents: totalAmount,
      skipped: summary.accruals.length - toInsert.length,
    },
  };
}

interface MarkPaidInput {
  payoutId: number;
  paymentReference: string;
  notes?: string;
}

/** Mark a pending payout as paid. The actual money moved offline — we just
 *  record the reference for audit. */
export async function markPayoutPaid(input: MarkPaidInput): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'No autenticado' };
  if (!isAdminRole(session.role)) {
    return { ok: false, error: 'Solo admins' };
  }
  if (!input.paymentReference?.trim()) {
    return { ok: false, error: 'payment_reference requerido' };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('engine_royalty_payouts')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      payment_reference: input.paymentReference.trim(),
      admin_notes: input.notes?.trim() || null,
    })
    .eq('id', input.payoutId)
    .eq('status', 'pending'); // defensive — don't transition cancelled→paid
  if (error) return { ok: false, error: error.message };

  revalidatePath('/[locale]', 'layout');
  return { ok: true };
}

/** Cancel a pending payout — for cases where the accrual was wrong (bad
 *  rate, duplicate counting, etc). Cancelled rows stay in the table for
 *  audit; they just don't show as "owed" anymore. */
export async function cancelPayout(
  payoutId: number,
  reason: string,
): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'No autenticado' };
  if (!isAdminRole(session.role)) {
    return { ok: false, error: 'Solo admins' };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from('engine_royalty_payouts')
    .update({
      status: 'cancelled',
      admin_notes: reason || 'cancelled (no reason given)',
    })
    .eq('id', payoutId)
    .eq('status', 'pending');
  if (error) return { ok: false, error: error.message };

  revalidatePath('/[locale]', 'layout');
  return { ok: true };
}
