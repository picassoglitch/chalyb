'use server';

// Admin-only: manually grant or revoke bonus tokens for a user.
//
// Grants land in profiles.token_bonus_balance (the same column MP
// top-up purchases write to). Bonus tokens never reset — they
// accumulate alongside the monthly tier allocation.
//
// USAGE PATTERNS:
//   - Customer-support credit: refund + 100k tokens after a failed batch
//   - Promo: throw 500k at a partner's testers
//   - Reconciliation: subtract a wrongly-granted pack
//   - Demo: zero out a test account's bonus before a sales call
//
// Negative amounts are allowed (revoke) but the resulting balance is clamped
// at 0 — we never owe a user negative tokens. Server-side enforcement; the
// UI just sends the delta.
//
// Every change is audited so the team page's "Audit log" tab shows the
// history of grants alongside tier changes + role changes.

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';
import { getSessionUser } from '@/lib/auth/session';
import { isAdminRole } from '@/lib/billing/tiers';

interface ActionResult {
  ok: boolean;
  error?: string;
  /** Resulting balance after the change — handy for the UI to update without
   *  re-fetching. */
  newBalance?: number;
}

// Hard cap so a typo can't accidentally grant a billion tokens. 50M is
// 25× the VIP monthly allocation — generous enough for any real
// customer-support refund, low enough to avoid disaster.
const MAX_GRANT_PER_CALL = 50_000_000;

export async function grantTokensToUser(
  targetUserId: string,
  delta: number,
  reason: string | null = null,
): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'No autenticado' };
  if (!isAdminRole(session.role)) {
    return { ok: false, error: 'Solo admins pueden otorgar tokens' };
  }
  if (!targetUserId) return { ok: false, error: 'Usuario inválido' };
  if (!Number.isFinite(delta) || delta === 0) {
    return { ok: false, error: 'Cantidad inválida' };
  }
  if (Math.abs(delta) > MAX_GRANT_PER_CALL) {
    return {
      ok: false,
      error: `Máximo ${MAX_GRANT_PER_CALL.toLocaleString('es-MX')} tokens por operación`,
    };
  }
  const intDelta = Math.trunc(delta);

  const admin = createAdminClient();

  // Read current balance + email (for audit) in one round-trip.
  const { data: before, error: readErr } = await admin
    .from('profiles')
    .select('email, token_bonus_balance')
    .eq('id', targetUserId)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!before) return { ok: false, error: 'Usuario no encontrado' };

  const previousBalance = (before.token_bonus_balance as number | null) ?? 0;
  // Clamp at 0: revoking 500k from a user with 200k leaves them at 0, not -300k.
  const nextBalance = Math.max(0, previousBalance + intDelta);
  // Actual delta after clamping (useful for the audit log so we don't claim
  // we removed 500k when we actually only removed 200k).
  const effectiveDelta = nextBalance - previousBalance;

  if (effectiveDelta === 0) {
    return {
      ok: false,
      error: 'El balance no cambió (ya estaba en 0).',
    };
  }

  const { error: updErr } = await admin
    .from('profiles')
    .update({ token_bonus_balance: nextBalance })
    .eq('id', targetUserId);
  if (updErr) return { ok: false, error: updErr.message };

  // For positive grants we ALSO write a token_pack_purchases row so the
  // user's /app/usage history shows where the bonus came from. We skip
  // this on revokes because the table is purchase-shaped (negative
  // 'tokens_granted' would be misleading). Revokes are admin-only and
  // tracked via the audit log instead.
  if (effectiveDelta > 0) {
    const { error: insertErr } = await admin.from('token_pack_purchases').insert({
      user_id: targetUserId,
      tokens_granted: effectiveDelta,
      source: 'admin_grant',
      mp_payment_id: null,
    });
    if (insertErr) {
      // Non-fatal — the balance bump already happened. Log so the admin
      // sees it in the response but don't roll back.
      console.warn('[tokens.grant] purchase row insert failed:', insertErr.message);
    }
  }

  await logAudit({
    action: effectiveDelta > 0 ? 'tokens.grant' : 'tokens.revoke',
    actorId: session.user.id,
    actorEmail: session.user.email ?? null,
    targetUserId,
    targetEmail: (before.email as string | null) ?? null,
    before: { token_bonus_balance: previousBalance },
    after: { token_bonus_balance: nextBalance },
    metadata: {
      requested_delta: intDelta,
      effective_delta: effectiveDelta,
      reason: reason ?? null,
      via: 'team_page',
    },
  });

  // Both the team page (admin view) and the target's /app/usage page show
  // bonus balance. Layout-level revalidate keeps both in sync.
  revalidatePath('/[locale]', 'layout');

  return { ok: true, newBalance: nextBalance };
}
