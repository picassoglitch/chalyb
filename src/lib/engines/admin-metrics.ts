// Per-engine operational metrics for the admin detail page.
//
// Pulls everything the admin needs to make business decisions about a
// single engine in one round-trip-shaped function: subscriber counts,
// token consumption, revenue, and operational cost. The page-level
// component just renders what's here.
//
// Tokens are billable_tokens (migration 0046): every meter in the unit users
// are charged in, not llm.tokens alone. Sums come from engine_usage_metrics()
// (migration 0047), so no row cap can shrink them.
//
// Cost math (cents MXN, all integer):
//
//   llm_variable    = reported provider cost (cost_usd_micros) in MXN
//                     + events without a reported cost × cost_per_million_tokens_cents / 1_000_000
//   royalty_payable = tokens_this_month × partner_royalty_per_million_tokens_cents / 1_000_000
//   total_monthly   = llm_variable + fixed_monthly_cost_cents + royalty_payable
//   margin_cents    = revenue_this_month_cents − total_monthly
//   margin_pct      = margin_cents / revenue_this_month_cents × 100  (when revenue > 0)
//
// Revenue source for now: payments rows from this period by users who have
// an active engine_subscription on THIS engine, each payment split evenly
// across the engines that user is active on — so summing this figure over
// every engine gives total revenue once, not once per engine.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export interface EngineMetrics {
  // Core counts
  totalSubs: number;
  activeSubs: number;
  pausedSubs: number;
  usersActiveThisMonth: number;
  newSubsThisMonth: number;
  // Tokens
  tokensThisMonth: number;
  tokensLifetime: number;
  tokensLast7d: number;
  // Per-operation breakdown (this month, sorted desc)
  byOperation: Array<{ operation: string; tokens: number; calls: number }>;
  // Cost math (all cents MXN)
  llmVariableCostCents: number;
  fixedMonthlyCostCents: number;
  royaltyPayableCents: number;
  totalCostCents: number;
  // Revenue attribution (approximate — see file header)
  revenueCentsThisMonth: number;
  marginCents: number;
  marginPct: number | null; // null when revenue = 0
  // Top users (this month, desc)
  topUsers: Array<{
    userId: string;
    email: string | null;
    fullName: string | null;
    tokens: number;
    /** What THIS user cost the platform this month, derived from their
     *  token consumption × engines.cost_per_million_tokens_cents. Cents
     *  MXN. Always 0 when the engine has no cost rate configured. */
    costCents: number;
    /** Per-user share of the engine's royalty payable this month
     *  (tokens × royalty_rate / 1M). Cents MXN. Useful for attribution
     *  when one user generates the bulk of the partner payout. */
    royaltyShareCents: number;
  }>;
  // Recent events (raw, for the activity feed)
  recentEvents: Array<{
    id: string;
    userId: string;
    userEmail: string | null;
    kind: string;
    amount: number;
    operation: string | null;
    occurredAt: string;
  }>;
  // Snapshot of when we computed this — useful in the "as of" caption.
  computedAt: string;
}

function startOfDayUtc(daysAgo: number = 0): string {
  const t = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
  return new Date(new Date(t).toISOString().slice(0, 10) + 'T00:00:00.000Z').toISOString();
}

function startOfMonthUtc(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function getEngineMetrics(opts: {
  engineId: string;
  costPerMillionTokensCents: number;
  fixedMonthlyCostCents: number;
  partnerRoyaltyPerMillionTokensCents: number;
}): Promise<EngineMetrics> {
  const admin = createAdminClient();
  const monthStart = startOfMonthUtc();
  const weekAgo = startOfDayUtc(7);

  // Six independent queries — runs in parallel. Each touches its own
  // index path. Hot enough at our scale to skip caching; revisit if a
  // /dashboard/engines/* impression budget appears.
  const [
    subsResult,
    activeSubsResult,
    pausedSubsResult,
    newSubsResult,
    metricsResult,
    recentResult,
    paymentsResult,
  ] = await Promise.all([
    // Total subs (any status) — gives the "ever activated" count.
    admin
      .from('engine_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('engine_id', opts.engineId),
    admin
      .from('engine_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('engine_id', opts.engineId)
      .eq('status', 'active'),
    admin
      .from('engine_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('engine_id', opts.engineId)
      .eq('status', 'paused'),
    admin
      .from('engine_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('engine_id', opts.engineId)
      .gte('created_at', monthStart),
    admin.rpc('engine_usage_metrics', {
      p_engine_id: opts.engineId,
      p_month_start: monthStart,
      p_week_start: weekAgo,
    }),
    // Recent events (raw) for the activity feed.
    admin
      .from('usage_events')
      .select('id, user_id, kind, amount, billable_tokens, operation, occurred_at')
      .eq('engine_id', opts.engineId)
      .order('occurred_at', { ascending: false })
      .limit(20),
    // Revenue this month — coarse: any payment from a user who has an
    // active sub on this engine. See file header for caveats.
    admin
      .from('engine_subscriptions')
      .select('user_id')
      .eq('engine_id', opts.engineId)
      .eq('status', 'active'),
  ]);

  if (metricsResult.error) {
    throw new Error(`engine_usage_metrics failed: ${metricsResult.error.message}`);
  }
  const m = (metricsResult.data ?? {}) as {
    month?: { billable?: number; cost_usd_micros?: number; billable_without_cost?: number; users?: number };
    lifetime?: number;
    week?: number;
    by_operation?: Array<{ operation: string; tokens: number; calls: number }>;
    top_users?: Array<{ user_id: string; tokens: number; cost_usd_micros: number; billable_without_cost: number }>;
  };
  const tokensThisMonth = Number(m.month?.billable ?? 0);
  const tokensLifetime = Number(m.lifetime ?? 0);
  const tokensLast7d = Number(m.week ?? 0);
  const usersActiveThisMonth = Number(m.month?.users ?? 0);

  const usdToMxn = Number(process.env.ANTHROPIC_USD_TO_MXN ?? 18);
  // micros of USD → cents of MXN: / 1e6 × rate × 100.
  const costCentsOf = (costUsdMicros: number, billableWithoutCost: number) =>
    Math.floor((costUsdMicros * usdToMxn) / 10_000) +
    Math.floor((billableWithoutCost * opts.costPerMillionTokensCents) / 1_000_000);

  const recentEvents: EngineMetrics['recentEvents'] = (recentResult.data ?? []).map((row) => ({
    id: row.id as string,
    userId: (row.user_id as string | null) ?? '',
    userEmail: null, // filled in below
    kind: (row.kind as string) ?? 'llm.tokens',
    amount: Number(row.billable_tokens ?? row.amount ?? 0),
    operation: (row.operation as string | null) ?? null,
    occurredAt: (row.occurred_at as string) ?? '',
  }));
  const topRows = m.top_users ?? [];

  // Hydrate top users + recent event user emails in a single batch.
  const topUserIds = topRows.map((r) => r.user_id);
  const recentUserIds = recentEvents.map((e) => e.userId).filter(Boolean);
  const userIdsToFetch = Array.from(new Set([...topUserIds, ...recentUserIds]));
  const profilesById = new Map<
    string,
    { email: string | null; fullName: string | null }
  >();
  if (userIdsToFetch.length > 0) {
    const { data: profilesRaw } = await admin
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIdsToFetch);
    for (const p of profilesRaw ?? []) {
      profilesById.set(p.id as string, {
        email: (p.email as string | null) ?? null,
        fullName: (p.full_name as string | null) ?? null,
      });
    }
  }
  for (const e of recentEvents) {
    e.userEmail = profilesById.get(e.userId)?.email ?? null;
  }
  const topUsers = topRows.map((r) => {
    const userId = r.user_id;
    const tokens = Number(r.tokens);
    return {
      userId,
      email: profilesById.get(userId)?.email ?? null,
      fullName: profilesById.get(userId)?.fullName ?? null,
      tokens,
      // Floor at the integer-cent level — never claim a higher cost than
      // the math actually produces.
      costCents: costCentsOf(Number(r.cost_usd_micros), Number(r.billable_without_cost)),
      royaltyShareCents: Math.floor(
        (tokens * opts.partnerRoyaltyPerMillionTokensCents) / 1_000_000,
      ),
    };
  });

  // Revenue: payments from active-sub users this month, each split across
  // the engines its payer is active on.
  const subUserIds = ((paymentsResult.data ?? []) as Array<{ user_id: string }>)
    .map((r) => r.user_id)
    .filter(Boolean);
  let revenueCentsThisMonth = 0;
  if (subUserIds.length > 0) {
    const [{ data: payRows }, { data: allSubs }] = await Promise.all([
      admin
        .from('payments')
        .select('user_id, amount_cents')
        .in('user_id', subUserIds)
        .eq('status', 'approved')
        .gte('created_at', monthStart),
      admin
        .from('engine_subscriptions')
        .select('user_id')
        .in('user_id', subUserIds)
        .eq('status', 'active'),
    ]);
    const enginesPerUser = new Map<string, number>();
    for (const r of allSubs ?? []) {
      const id = r.user_id as string;
      enginesPerUser.set(id, (enginesPerUser.get(id) ?? 0) + 1);
    }
    revenueCentsThisMonth = Math.floor(
      (payRows ?? []).reduce<number>(
        (sum, r) =>
          sum +
          ((r.amount_cents as number | null) ?? 0) /
            Math.max(1, enginesPerUser.get(r.user_id as string) ?? 1),
        0,
      ),
    );
  }

  // Cost math.
  const llmVariableCostCents = costCentsOf(
    Number(m.month?.cost_usd_micros ?? 0),
    Number(m.month?.billable_without_cost ?? 0),
  );
  const royaltyPayableCents = Math.floor(
    (tokensThisMonth * opts.partnerRoyaltyPerMillionTokensCents) / 1_000_000,
  );
  const totalCostCents = llmVariableCostCents + opts.fixedMonthlyCostCents + royaltyPayableCents;
  const marginCents = revenueCentsThisMonth - totalCostCents;
  const marginPct =
    revenueCentsThisMonth > 0 ? (marginCents / revenueCentsThisMonth) * 100 : null;

  const byOperation = (m.by_operation ?? []).map((o) => ({
    operation: o.operation ?? 'sin tag',
    tokens: Number(o.tokens),
    calls: Number(o.calls),
  }));

  return {
    totalSubs: subsResult.count ?? 0,
    activeSubs: activeSubsResult.count ?? 0,
    pausedSubs: pausedSubsResult.count ?? 0,
    usersActiveThisMonth,
    newSubsThisMonth: newSubsResult.count ?? 0,
    tokensThisMonth,
    tokensLifetime,
    tokensLast7d,
    byOperation,
    llmVariableCostCents,
    fixedMonthlyCostCents: opts.fixedMonthlyCostCents,
    royaltyPayableCents,
    totalCostCents,
    revenueCentsThisMonth,
    marginCents,
    marginPct,
    topUsers,
    recentEvents,
    computedAt: new Date().toISOString(),
  };
}
