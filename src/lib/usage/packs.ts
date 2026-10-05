// Credit packs, one row each (migration 0061): what is left of each and
// whether it is spendable. Términos de los Paquetes de Créditos §4, §5, §8.
//
//   available  unused credits in active packs: spent after the plan's monthly
//              credits, oldest pack first, once
//   held       unused credits of a disputed pack (§8.2): set aside, still the
//              person's until the dispute ends
//
// For the account-closure warning (§5.2) "créditos extra sin usar" is
// available + held.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export type PackStatus = 'active' | 'held' | 'removed';

export interface PackBalance {
  id: string;
  tokensGranted: number;
  remaining: number;
  status: PackStatus;
  source: 'mp_payment' | 'admin_grant' | 'promo' | 'legacy';
  purchasedAt: string;
}

export interface PackSummary {
  available: number;
  held: number;
  /** Oldest first: the order they are spent in. Merged pre-0061 purchases
   *  are left out; their credits are in the 'legacy' pack. */
  packs: PackBalance[];
}

export async function getPackSummary(userId: string): Promise<PackSummary> {
  const { data, error } = await createAdminClient()
    .from('token_pack_purchases')
    .select('id, tokens_granted, tokens_remaining, status, source, created_at')
    .eq('user_id', userId)
    .neq('status', 'merged')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  // An unknown balance is not an empty one.
  if (error) throw new Error(`pack summary failed: ${error.message}`);
  const packs: PackBalance[] = (data ?? []).map((r) => ({
    id: r.id as string,
    tokensGranted: Number(r.tokens_granted),
    remaining: Number(r.tokens_remaining),
    status: r.status as PackStatus,
    source: r.source as PackBalance['source'],
    purchasedAt: r.created_at as string,
  }));
  const sum = (s: PackStatus) =>
    packs.filter((p) => p.status === s).reduce((n, p) => n + p.remaining, 0);
  return { available: sum('active'), held: sum('held'), packs };
}

/** Set a disputed pack's unused credits aside (§8.2). Idempotent. */
export async function holdTokenPack(mpPaymentId: string): Promise<{ ok: boolean; held?: number }> {
  const { data, error } = await createAdminClient().rpc('hold_token_pack', {
    p_mp_payment_id: mpPaymentId,
  });
  if (error) {
    console.error('[packs] hold_token_pack failed', error.message);
    return { ok: false };
  }
  const r = (data ?? {}) as { ok?: boolean; error?: string; tokens_held?: number };
  // A dispute on a payment that bought no pack has nothing to hold.
  if (r.ok === false) return { ok: r.error === 'no_purchase' };
  return { ok: true, held: Number(r.tokens_held ?? 0) };
}

/** The dispute ended in Chalyb's favour: the credits can be used again (§8.3). */
export async function releaseTokenPack(
  mpPaymentId: string,
): Promise<{ ok: boolean; released?: number }> {
  const { data, error } = await createAdminClient().rpc('release_token_pack', {
    p_mp_payment_id: mpPaymentId,
  });
  if (error) {
    console.error('[packs] release_token_pack failed', error.message);
    return { ok: false };
  }
  const r = (data ?? {}) as { ok?: boolean; error?: string; tokens_released?: number };
  if (r.ok === false) return { ok: r.error === 'no_purchase' };
  return { ok: true, released: Number(r.tokens_released ?? 0) };
}
