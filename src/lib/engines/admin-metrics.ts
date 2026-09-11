// Per-engine operational metrics for the admin detail page.
//
// Pulls everything the admin needs to make business decisions about a
// single engine in one round-trip-shaped function: subscriber counts,
// token consumption, revenue, and operational cost. The page-level
// component just renders what's here.
//
// Cost math (cents MXN, all integer):
//
//   llm_variable    = tokens_this_month × cost_per_million_tokens_cents / 1_000_000
//   royalty_payable = tokens_this_month × partner_royalty_per_million_tokens_cents / 1_000_000
//   total_monthly   = llm_variable + fixed_monthly_cost_cents + royalty_payable
//   margin_cents    = revenue_this_month_cents − total_monthly
//   margin_pct      = margin_cents / revenue_this_month_cents × 100  (when revenue > 0)
//
// Revenue source for now: payments rows from this period filtered to users
// who have an active engine_subscription on THIS engine. Coarse — a user
// who pays for VIP generates payment rows that get split N ways
// across the engines they use — but matches the existing /dashboard/overview
// approximation and is honest about scale (we have ~0 paying users today,
// fancy attribution is premature).

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
    usageThisMonthResult,
    usageLifetimeResult,
    usageLast7dResult,
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
    // Full usage rows for this month — we aggregate in JS so we can pull
    // per-user, per-operation, and total in one pass.
    admin
      .from('usage_events')
      .select('id, user_id, kind, amount, operation, occurred_at')
      .eq('engine_id', opts.engineId)
      .eq('kind', 'llm.tokens')
      .gte('occurred_at', monthStart)
      .order('occurred_at', { ascending: false })
      .limit(2000),
    // Lifetime total — just amounts.
    admin
      .from('usage_events')
      .select('amount')
      .eq('engine_id', opts.engineId)
      .eq('kind', 'llm.tokens'),
    // Last 7 days for the trend chip.
    admin
      .from('usage_events')
      .select('amount')
      .eq('engine_id', opts.engineId)
      .eq('kind', 'llm.tokens')
      .gte('occurred_at', weekAgo),
    // Revenue this month — coarse: any payment from a user who has an
    // active sub on this engine. See file header for caveats.
    admin
      .from('engine_subscriptions')
      .select('user_id')
      .eq('engine_id', opts.engineId)
      .eq('status', 'active'),
  ]);

  // Token aggregation (this month).
  let tokensThisMonth = 0;
  const perUser = new Map<string, number>();
  const perOp = new Map<string, { tokens: number; calls: number }>();
  const recentEvents: EngineMetrics['recentEvents'] = [];
  for (const row of usageThisMonthResult.data ?? []) {
    const amount = (row.amount as number | null) ?? 0;
    const userId = (row.user_id as string | null) ?? '';
    const op = (row.operation as string | null) ?? 'sin tag';
    tokensThisMonth += amount;
    if (userId) {
      perUser.set(userId, (perUser.get(userId) ?? 0) + amount);
    }
    const opEntry = perOp.get(op) ?? { tokens: 0, calls: 0 };
    opEntry.tokens += amount;
    opEntry.calls += 1;
    perOp.set(op, opEntry);
    if (recentEvents.length < 20) {
      recentEvents.push({
        id: row.id as string,
        userId,
        userEmail: null, // filled in below
        kind: (row.kind as string) ?? 'llm.tokens',
        amount,
        operation: (row.operation as string | null) ?? null,
        occurredAt: (row.occurred_at as string) ?? '',
      });
    }
  }

  const tokensLifetime = (usageLifetimeResult.data ?? []).reduce<number>(
    (sum, r) => sum + ((r.amount as number | null) ?? 0),
    0,
  );
  const tokensLast7d = (usageLast7dResult.data ?? []).reduce<number>(
    (sum, r) => sum + ((r.amount as number | null) ?? 0),
    0,
  );

  // Hydrate top users + recent event user emails in a single batch.
  const topUserIds = Array.from(perUser.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id);
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
  const topUsers = topUserIds.map((userId) => {
    const tokens = perUser.get(userId) ?? 0;
    return {
      userId,
      email: profilesById.get(userId)?.email ?? null,
      fullName: profilesById.get(userId)?.fullName ?? null,
      tokens,
      // Floor at the integer-cent level — never claim a higher cost than
      // the math actually produces.
      costCents: Math.floor(
        (tokens * opts.costPerMillionTokensCents) / 1_000_000,
      ),
      royaltyShareCents: Math.floor(
        (tokens * opts.partnerRoyaltyPerMillionTokensCents) / 1_000_000,
      ),
    };
  });

  // Revenue (coarse): SUM payments from active-sub users this month.
  const subUserIds = ((paymentsResult.data ?? []) as Array<{ user_id: string }>)
    .map((r) => r.user_id)
    .filter(Boolean);
  let revenueCentsThisMonth = 0;
  if (subUserIds.length > 0) {
    const { data: payRows } = await admin
      .from('payments')
      .select('amount_cents')
      .in('user_id', subUserIds)
      .eq('status', 'approved')
      .gte('created_at', monthStart);
    revenueCentsThisMonth = (payRows ?? []).reduce<number>(
      (sum, r) => sum + ((r.amount_cents as number | null) ?? 0),
      0,
    );
  }

  // Cost math.
  const llmVariableCostCents = Math.floor(
    (tokensThisMonth * opts.costPerMillionTokensCents) / 1_000_000,
  );
  const royaltyPayableCents = Math.floor(
    (tokensThisMonth * opts.partnerRoyaltyPerMillionTokensCents) / 1_000_000,
  );
  const totalCostCents = llmVariableCostCents + opts.fixedMonthlyCostCents + royaltyPayableCents;
  const marginCents = revenueCentsThisMonth - totalCostCents;
  const marginPct =
    revenueCentsThisMonth > 0 ? (marginCents / revenueCentsThisMonth) * 100 : null;

  const byOperation = Array.from(perOp.entries())
    .map(([operation, agg]) => ({ operation, tokens: agg.tokens, calls: agg.calls }))
    .sort((a, b) => b.tokens - a.tokens);

  return {
    totalSubs: subsResult.count ?? 0,
    activeSubs: activeSubsResult.count ?? 0,
    pausedSubs: pausedSubsResult.count ?? 0,
    usersActiveThisMonth: perUser.size,
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
