// The daily safety net for token packs (billing review of PR #41): a pack
// paid through the hosted checkout is granted by the webhook, and a grant
// that fails after the route already answered Mercado Pago (ACK_BUDGET_MS)
// is only logged — no retry comes. This finds approved pack charges with no
// purchase on file and grants them, through the same price gate and the
// same idempotent grant (grant_token_pack refuses a payment twice).

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { notify } from '@/lib/notifications/notify';
import { grantTokenPack } from '@/lib/usage/tokens';
import { getTokenPack, type PackTotals } from './pricing';
import { acceptedPackCents, loadPricedPacks } from './pack-prices';
import { checkCharge, expectedChargeForPack } from './webhook-verify';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

export interface PackChargeRow {
  mp_payment_id: string;
  user_id: string;
  pack_id: string | null;
  amount_cents: number | null;
  currency: string | null;
  refunded_cents: number | null;
}

/**
 * Which approved pack charges are owed their tokens: no purchase on file,
 * nothing refunded, a known pack, and the amount and currency its price
 * (the webhook's gate: a refused charge is never granted here). `totals`
 * are the pack prices in force; `accepted` the amounts each buyer accepted
 * per pack ("<userId>|<packId>"). Pure.
 */
export function packsOwed(
  rows: readonly PackChargeRow[],
  purchased: ReadonlySet<string>,
  totals: PackTotals,
  accepted: ReadonlyMap<string, readonly number[]> = new Map(),
): { row: PackChargeRow; tokens: number }[] {
  const out: { row: PackChargeRow; tokens: number }[] = [];
  for (const row of rows) {
    if (purchased.has(row.mp_payment_id)) continue;
    if ((row.refunded_cents ?? 0) > 0) continue;
    const pack = row.pack_id ? getTokenPack(row.pack_id) : undefined;
    if (!pack) continue;
    const expected = expectedChargeForPack(
      pack.id,
      totals[pack.id],
      accepted.get(`${row.user_id}|${pack.id}`) ?? [],
    );
    if (!expected) continue;
    const check = checkCharge(expected, {
      amountMajor: row.amount_cents === null ? null : row.amount_cents / 100,
      currency: row.currency,
    });
    if (!check.ok) continue;
    out.push({ row, tokens: pack.tokens });
  }
  return out;
}

/** Grants what packsOwed() finds among the last week's approved charges
 *  (older than 10 minutes, so a webhook still running isn't raced). */
export async function reconcilePackGrants(now: Date): Promise<{ granted: number; failed: number }> {
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from('payments')
    .select('mp_payment_id, user_id, pack_id, amount_cents, currency, refunded_cents')
    .eq('kind', 'pack')
    .eq('status', 'approved')
    .gte('created_at', new Date(now.getTime() - 7 * DAY).toISOString())
    .lte('created_at', new Date(now.getTime() - 10 * MINUTE).toISOString())
    .limit(200);
  if (error) throw new Error(error.message);
  const list = (rows ?? []) as PackChargeRow[];
  if (list.length === 0) return { granted: 0, failed: 0 };
  const { data: purchases, error: pErr } = await admin
    .from('token_pack_purchases')
    .select('mp_payment_id')
    .in(
      'mp_payment_id',
      list.map((r) => r.mp_payment_id),
    );
  if (pErr) throw new Error(pErr.message);
  const purchased = new Set((purchases ?? []).map((p) => p.mp_payment_id as string));
  // No prices in force → grant nothing today; the next run tries again.
  const priced = await loadPricedPacks();
  if (!priced) throw new Error('pack prices unavailable');
  const accepted = new Map<string, number[]>();
  for (const r of list) {
    const key = `${r.user_id}|${r.pack_id}`;
    if (!r.pack_id || accepted.has(key) || purchased.has(r.mp_payment_id)) continue;
    accepted.set(key, await acceptedPackCents(r.user_id, r.pack_id, now, 14));
  }
  let granted = 0;
  let failed = 0;
  for (const { row, tokens } of packsOwed(list, purchased, priced.totals, accepted)) {
    const r = await grantTokenPack({
      userId: row.user_id,
      tokens,
      source: 'mp_payment',
      mpPaymentId: row.mp_payment_id,
    });
    if (!r.ok) {
      failed += 1;
      continue;
    }
    if (!r.alreadyGranted) {
      granted += 1;
      await notify({
        severity: 'warning',
        title: `Pack acreditado por la conciliación — ${tokens.toLocaleString('es-MX')} tokens`,
        body: `MP pago ${row.mp_payment_id}: el webhook no lo había acreditado.`,
        href: '/dashboard/billing',
        source: 'billing.cron',
      });
    }
  }
  return { granted, failed };
}
