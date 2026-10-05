'use server';

// Admin-only: manually grant or revoke bonus tokens for a user.
//
// A grant lands as its own pack in token_pack_purchases, like an MP top-up
// (profiles.token_bonus_balance mirrors the packs). Pack credits never reset;
// they are spent after the monthly plan allocation, once, oldest first.
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

  // Email for the audit log. The balance is NOT read here — see below.
  const { data: before, error: readErr } = await admin
    .from('profiles')
    .select('email')
    .eq('id', targetUserId)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!before) return { ok: false, error: 'Usuario no encontrado' };

  // One statement does the read, the clamp and the write under a row lock
  // (migration 0033). Doing it here in JS meant a grant issued while a paid
  // token pack was being credited wrote back a stale balance and erased the
  // pack. The function hands back both balances so the audit log below still
  // records the real before/after, and the effective delta after clamping —
  // revoking 500k from a user holding 200k reports -200k, not -500k.
  const { data: adjusted, error: updErr } = await admin.rpc('adjust_token_bonus_balance', {
    p_user_id: targetUserId,
    p_delta: intDelta,
  });
  if (updErr) return { ok: false, error: updErr.message };

  const result = (adjusted ?? {}) as {
    ok?: boolean;
    previous_balance?: number;
    balance?: number;
    effective_delta?: number;
  };
  if (!result.ok) return { ok: false, error: 'Usuario no encontrado' };

  const previousBalance = result.previous_balance ?? 0;
  const nextBalance = result.balance ?? previousBalance;
  const effectiveDelta = result.effective_delta ?? 0;

  if (effectiveDelta === 0) {
    return {
      ok: false,
      error: 'El balance no cambió (ya estaba en 0).',
    };
  }

  // A positive grant is its own pack row (admin_grant), written by the same
  // function (migration 0065), so it shows in the history and is spent in
  // order like any pack. A revoke takes unused credits oldest pack first.

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
