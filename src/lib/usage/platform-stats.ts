// Platform-wide token usage aggregates for the admin overview.
// Server-only — uses the service-role client to bypass RLS (admin pages
// already check role + redirect non-admins before invoking).

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export interface PlatformTokenStats {
  /** Total tokens spent this calendar month, summed across every user and engine. */
  monthTotal: number;
  /** Total spent in the last 7 rolling days. Strictly less than monthTotal
   *  early in the month and possibly larger than monthTotal late in the month
   *  if the 7-day window crosses the period boundary. */
  weekTotal: number;
  /** Total spent ever (since usage_events was first written to). Useful as a
   *  "lifetime" counter on the overview card. */
  allTimeTotal: number;
  /** Breakdown for the current calendar month, sorted by tokens desc. */
  byEngineThisMonth: Array<{
    engineId: string;
    engineSlug: string;
    engineName: string;
    tokens: number;
    /** Unique users who consumed any tokens on this engine this month. */
    activeUsers: number;
  }>;
  /** How many users have spent ≥1 token this month. Cheap "DAU/MAU"-style stat. */
  activeUsersThisMonth: number;
  /** Snapshot of the first instant of the period the monthTotal covers. */
  periodStart: string;
}

function currentPeriodStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function sevenDaysAgoIso(): string {
  const t = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return new Date(t).toISOString();
}

/** Aggregate token usage across every user + every engine.
 *
 *  REFACTORED (migration 0017): previously this pulled EVERY llm.tokens
 *  usage_events row (no time bound) over PostgREST and aggregated in Node.
 *  On Supabase nano with thousands of events that round-trip was hitting
 *  the 19s edge timeout → Cloudflare 522s → "project unhealthy" alerts.
 *
 *  The new path calls `compute_platform_token_stats` which returns:
 *    - 3 scalar rows: scope = 'all_time' | 'month' | 'week'
 *    - N per-engine rows: scope = 'per_engine', one per active engine
 *  Total payload: ~ (3 + #engines) rows instead of N events. Aggregation
 *  + DISTINCT user counts happen server-side in a single transaction with
 *  an 8s statement_timeout safety net. */
export async function getPlatformTokenStats(): Promise<PlatformTokenStats> {
  const admin = createAdminClient();
  const periodStart = currentPeriodStartIso();
  const weekStart = sevenDaysAgoIso();

  const emptyResult: PlatformTokenStats = {
    monthTotal: 0,
    weekTotal: 0,
    allTimeTotal: 0,
    byEngineThisMonth: [],
    activeUsersThisMonth: 0,
    periodStart,
  };

  const { data: rpcRaw, error } = await admin.rpc('compute_platform_token_stats', {
    p_period_start: periodStart,
    p_week_start: weekStart,
  });
  if (error) {
    console.error('[platform-stats] RPC failed:', error.message);
    return emptyResult;
  }

  const rows = (rpcRaw ?? []) as Array<{
    scope: 'all_time' | 'month' | 'week' | 'per_engine';
    engine_id: string | null;
    engine_slug: string | null;
    engine_name: string | null;
    tokens: number;
    active_users: number;
  }>;

  // Split rows by discriminator. The 3 scalar rows are guaranteed to be
  // present (the RPC SELECTs them unconditionally — sum returns 0 on empty).
  let monthTotal = 0;
  let weekTotal = 0;
  let allTimeTotal = 0;
  let activeUsersThisMonth = 0;
  const byEngine: PlatformTokenStats['byEngineThisMonth'] = [];

  for (const row of rows) {
    if (row.scope === 'all_time') {
      allTimeTotal = row.tokens;
    } else if (row.scope === 'month') {
      monthTotal = row.tokens;
      activeUsersThisMonth = row.active_users;
    } else if (row.scope === 'week') {
      weekTotal = row.tokens;
    } else if (row.scope === 'per_engine' && row.engine_id) {
      byEngine.push({
        engineId: row.engine_id,
        engineSlug: row.engine_slug ?? 'unknown',
        engineName: row.engine_name ?? 'Engine eliminado',
        tokens: row.tokens,
        activeUsers: row.active_users,
      });
    }
  }

  byEngine.sort((a, b) => b.tokens - a.tokens);

  return {
    monthTotal,
    weekTotal,
    allTimeTotal,
    byEngineThisMonth: byEngine,
    activeUsersThisMonth,
    periodStart,
  };
}
