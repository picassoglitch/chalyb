// What a user has consumed this period, for the quota bars on Mi plan.
// Same sources the caps are enforced from (usage_balance() and
// usage_reservations), so the bar and the refusal can't disagree.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTokenBalance } from './tokens';
import { countedReservations, type ReservationRow } from './consumption-core';

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
      .select('id, status, source_minutes, created_at, outputs')
      .eq('user_id', userId)
      .eq('class', 'job')
      .neq('status', 'cancelled')
      .gte(
        'created_at',
        new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString(),
      )
      // Earliest first, like admit_usage: the free failed retries are the first ones.
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(50_000),
  ]);
  const expired = (rows ?? []).filter((r) => r.status === 'expired').map((r) => r.id as string);
  const { data: events } = expired.length
    ? await admin.from('usage_events').select('reservation_id').in('reservation_id', expired)
    : { data: [] as { reservation_id: string }[] };
  const reported = new Set((events ?? []).map((e) => e.reservation_id as string));
  const list = countedReservations((rows ?? []) as ReservationRow[], reported);
  return {
    tokensUsed: balance.monthlyUsed,
    jobs: list.length,
    sourceMinutes: Math.round(list.reduce((s, r) => s + Number(r.source_minutes ?? 0), 0)),
    running: list.filter((r) => r.status === 'open').length,
  };
}
