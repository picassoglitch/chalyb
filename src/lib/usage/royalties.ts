// Engine royalty accruals + payouts.
//
// Two complementary surfaces:
//
//   1. Live accruals — computed every read from usage_events × the engine's
//      partner_royalty_per_million_tokens_cents rate. Reflects the current
//      period (this calendar month) and lets the admin see "what we'd owe
//      if we finalized today". Per-period, per-engine, scoped to engines
//      whose partner_royalty_per_million_tokens_cents > 0 AND that have
//      an owner_user_id assigned.
//
//   2. Finalized payouts — rows in engine_royalty_payouts. Created by
//      finalizePeriod() which snapshots the current accruals as immutable
//      records. After finalization the admin records the actual payment
//      offline (bank transfer, MP one-shot, cash) and updates the row's
//      status to 'paid' with a payment_reference.
//
// The accrual math is dead simple by design:
//   amount_cents = tokens_attributed × rate / 1_000_000
//                                            ^^^^^^^^^^
//                              cents-per-million → cents
//
// All reads/writes go through the service-role admin client because these
// surfaces are admin-only. The partner-side view applies an RLS SELECT
// policy on engine_royalty_payouts and pulls accruals via a server fn
// that filters to engines.owner_user_id = current user.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export interface RoyaltyAccrual {
  engineId: string;
  engineSlug: string;
  engineName: string;
  partnerUserId: string;
  partnerEmail: string | null;
  partnerName: string | null;
  ratePerMillionCents: number;
  tokensThisPeriod: number;
  /** Already-finalized for this period — when present this engine's row
   *  shouldn't be finalized again. */
  alreadyFinalized: boolean;
  /** Live calculation: tokens × rate / 1_000_000. Floor instead of round
   *  so we never accidentally over-attribute. */
  accruedCents: number;
}

export interface RoyaltySummary {
  /** First instant of the current period (always UTC month start). */
  periodStart: string;
  /** Per-engine accruals where rate > 0 AND owner_user_id is set. */
  accruals: RoyaltyAccrual[];
  /** Grand total across all engines, for the page header. */
  totalAccruedCents: number;
  /** Count of partners that have a non-zero accrual. */
  partnersWithAccrual: number;
}

function currentPeriodStartIso(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
}

function nextMonthStartIso(periodStartIso: string): string {
  const d = new Date(periodStartIso);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString();
}

/** Aggregate every active royalty engine's accrual for the current period.
 *
 *  REFACTORED (migration 0017): the heavy lifting now happens in the
 *  Postgres RPC `compute_engine_royalties`. Previously this function pulled
 *  every llm.tokens usage_events row for the month + every royalty engine
 *  row, then summed in JS. On nano with thousands of events the round-trip
 *  was hitting the 19s edge timeout → CF 522 → "unhealthy" project flips.
 *
 *  The RPC does the GROUP BY + amount math server-side and returns one row
 *  per active partner-eligible engine. The remaining JS work (enriching
 *  with engine name/slug + partner profile + already-finalized check) only
 *  touches a handful of rows per call. */
export async function getCurrentPeriodAccruals(): Promise<RoyaltySummary> {
  const admin = createAdminClient();
  const periodStart = currentPeriodStartIso();
  const periodEnd = nextMonthStartIso(periodStart);

  const emptyResult: RoyaltySummary = {
    periodStart,
    accruals: [],
    totalAccruedCents: 0,
    partnersWithAccrual: 0,
  };

  // ── 1. One RPC instead of: usage_events fetch + engines fetch + JS sum.
  const { data: rpcRaw, error: rpcErr } = await admin.rpc(
    'compute_engine_royalties',
    { p_period_start: periodStart, p_period_end: periodEnd },
  );
  if (rpcErr) {
    console.error('[royalties] compute_engine_royalties RPC failed:', rpcErr.message);
    return emptyResult;
  }
  const accrualRows = (rpcRaw ?? []) as Array<{
    engine_id: string;
    partner_user_id: string;
    tokens_attributed: number;
    amount_cents: number;
    rate_per_million_cents: number;
  }>;
  if (accrualRows.length === 0) return emptyResult;

  // ── 2. Tiny hydration — engine display info + partner profiles + finalized
  //    payouts for THIS period. All bounded by the small `accrualRows` set.
  const engineIds = accrualRows.map((r) => r.engine_id);
  const partnerIds = Array.from(new Set(accrualRows.map((r) => r.partner_user_id)));

  const [{ data: enginesRaw }, { data: profilesRaw }, { data: finalizedRaw }] =
    await Promise.all([
      admin.from('engines').select('id, slug, name').in('id', engineIds),
      admin.from('profiles').select('id, email, full_name').in('id', partnerIds),
      admin
        .from('engine_royalty_payouts')
        .select('engine_id')
        .eq('period_start', periodStart)
        .in('engine_id', engineIds),
    ]);

  const engineMeta = new Map<string, { slug: string; name: string }>(
    (enginesRaw ?? []).map((e) => [
      e.id as string,
      { slug: e.slug as string, name: e.name as string },
    ]),
  );
  const profilesById = new Map<
    string,
    { email: string | null; name: string | null }
  >(
    (profilesRaw ?? []).map((p) => [
      p.id as string,
      {
        email: (p.email as string | null) ?? null,
        name: (p.full_name as string | null) ?? null,
      },
    ]),
  );
  const finalizedEngineIds = new Set(
    (finalizedRaw ?? []).map((r) => r.engine_id as string),
  );

  const accruals: RoyaltyAccrual[] = accrualRows.map((row) => {
    const engine = engineMeta.get(row.engine_id);
    const profile = profilesById.get(row.partner_user_id);
    return {
      engineId: row.engine_id,
      engineSlug: engine?.slug ?? '?',
      engineName: engine?.name ?? 'Engine eliminado',
      partnerUserId: row.partner_user_id,
      partnerEmail: profile?.email ?? null,
      partnerName: profile?.name ?? null,
      ratePerMillionCents: row.rate_per_million_cents,
      tokensThisPeriod: row.tokens_attributed,
      alreadyFinalized: finalizedEngineIds.has(row.engine_id),
      accruedCents: row.amount_cents,
    };
  });

  accruals.sort((a, b) => b.accruedCents - a.accruedCents);

  const partnersSet = new Set(
    accruals.filter((a) => a.accruedCents > 0).map((a) => a.partnerUserId),
  );
  const total = accruals.reduce(
    (sum, a) => (a.alreadyFinalized ? sum : sum + a.accruedCents),
    0,
  );

  return {
    periodStart,
    accruals,
    totalAccruedCents: total,
    partnersWithAccrual: partnersSet.size,
  };
}

export interface PayoutRow {
  id: number;
  engineId: string;
  engineSlug: string;
  engineName: string;
  partnerUserId: string;
  partnerEmail: string | null;
  partnerName: string | null;
  periodStart: string;
  tokensAttributed: number;
  amountCents: number;
  rateAtFinalizeCents: number;
  status: 'pending' | 'paid' | 'cancelled';
  paidAt: string | null;
  paymentReference: string | null;
  adminNotes: string | null;
  createdAt: string;
}

/** All payout rows ever, newest first. Used by the admin page's history. */
export async function getPayoutHistory(limit = 100): Promise<PayoutRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('engine_royalty_payouts')
    .select(
      'id, engine_id, partner_user_id, period_start, tokens_attributed, amount_cents, rate_per_million_cents_at_finalize, status, paid_at, payment_reference, admin_notes, created_at',
    )
    .order('period_start', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];

  // Hydrate engine + partner details in two parallel lookups.
  const engineIds = Array.from(new Set(data.map((r) => r.engine_id as string)));
  const partnerIds = Array.from(
    new Set(data.map((r) => r.partner_user_id as string)),
  );
  const [{ data: enginesRaw }, { data: profilesRaw }] = await Promise.all([
    engineIds.length > 0
      ? admin.from('engines').select('id, slug, name').in('id', engineIds)
      : Promise.resolve({ data: [] as Array<{ id: string; slug: string; name: string }> }),
    partnerIds.length > 0
      ? admin
          .from('profiles')
          .select('id, email, full_name')
          .in('id', partnerIds)
      : Promise.resolve({ data: [] as Array<{ id: string; email: string | null; full_name: string | null }> }),
  ]);
  const enginesById = new Map<string, { slug: string; name: string }>(
    (enginesRaw ?? []).map((e) => [
      e.id as string,
      { slug: e.slug as string, name: e.name as string },
    ]),
  );
  const profilesById = new Map<
    string,
    { email: string | null; name: string | null }
  >(
    (profilesRaw ?? []).map((p) => [
      p.id as string,
      {
        email: (p.email as string | null) ?? null,
        name: (p.full_name as string | null) ?? null,
      },
    ]),
  );

  return data.map((row) => {
    const engineId = row.engine_id as string;
    const partnerId = row.partner_user_id as string;
    const engine = enginesById.get(engineId);
    const partner = profilesById.get(partnerId);
    return {
      id: row.id as number,
      engineId,
      engineSlug: engine?.slug ?? '?',
      engineName: engine?.name ?? 'Engine eliminado',
      partnerUserId: partnerId,
      partnerEmail: partner?.email ?? null,
      partnerName: partner?.name ?? null,
      periodStart: row.period_start as string,
      tokensAttributed: row.tokens_attributed as number,
      amountCents: row.amount_cents as number,
      rateAtFinalizeCents: row.rate_per_million_cents_at_finalize as number,
      status: row.status as 'pending' | 'paid' | 'cancelled',
      paidAt: (row.paid_at as string | null) ?? null,
      paymentReference: (row.payment_reference as string | null) ?? null,
      adminNotes: (row.admin_notes as string | null) ?? null,
      createdAt: row.created_at as string,
    };
  });
}

/** Partner-scoped view: payouts where I'm the partner. Used by /app/usage's
 *  royalty section so partners can see what they've earned. */
export async function getPayoutsForPartner(partnerUserId: string): Promise<PayoutRow[]> {
  const all = await getPayoutHistory(500);
  return all.filter((p) => p.partnerUserId === partnerUserId);
}

/** Live partner-scoped accruals — current period only, just this partner's
 *  engines. Cheap because most partners own at most a handful of engines. */
export async function getCurrentAccrualsForPartner(
  partnerUserId: string,
): Promise<RoyaltyAccrual[]> {
  const summary = await getCurrentPeriodAccruals();
  return summary.accruals.filter((a) => a.partnerUserId === partnerUserId);
}
