// What a user has consumed this period, for the quota bars on Mi plan.
// Same sources the caps are enforced from (usage_balance() and
// usage_reservations), so the bar and the refusal can't disagree.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTokenBalance } from './tokens';

export interface ConsumptionUsage {
  tokensUsed: number;
  jobs: number;
  sourceMinutes: number;
  running: number;
}

export async function getConsumptionUsage(userId: string): Promise<ConsumptionUsage> {
  const admin = createAdminClient();
  const [balance, { data: rows }] = await Promise.all([
    getTokenBalance(userId),
    // Bounded: jobs_per_month tops out at 20k (VIP), well below what this
    // select returns in one page for any real month.
    admin
      .from('usage_reservations')
      .select('status, source_minutes')
      .eq('user_id', userId)
      .eq('class', 'job')
      .neq('status', 'cancelled')
      .gte(
        'created_at',
        new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString(),
      )
      .limit(50_000),
  ]);
  const list = rows ?? [];
  return {
    tokensUsed: balance.monthlyUsed,
    jobs: list.length,
    sourceMinutes: Math.round(list.reduce((s, r) => s + Number(r.source_minutes ?? 0), 0)),
    running: list.filter((r) => r.status === 'open').length,
  };
}
