// The real charge for one Clips video: the engine names its runs (usage job
// ids = our external_job_ids), the hub's ledger says what they cost.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  runCharge,
  type RunCharge,
  type RunEventRow,
  type RunReservationRow,
} from '@/lib/usage/run-charge';
import { CLIPS_SLUG } from './clips-engine';

const PAGE = 1000; // PostgREST's row cap: page so a long run isn't under-counted

export async function loadRunCharge(
  userId: string,
  usageJobIds: string[] | null | undefined,
): Promise<RunCharge | null> {
  // Engine too old to send the ids, or it couldn't read them: unknown, not zero.
  if (!Array.isArray(usageJobIds)) return null;
  if (usageJobIds.length === 0) return { state: 'none' };
  try {
    const db = createAdminClient();
    const engine = await db.from('engines').select('id').eq('slug', CLIPS_SLUG).maybeSingle();
    if (engine.error || !engine.data) throw new Error(engine.error?.message ?? 'no engine');
    const res = await db
      .from('usage_reservations')
      .select('id, status, est_tokens, fee_tokens, expires_at, settled_at')
      .eq('user_id', userId)
      .eq('engine_id', engine.data.id)
      .in('external_job_id', usageJobIds);
    if (res.error) throw new Error(res.error.message);
    const reservations = (res.data ?? []) as RunReservationRow[];
    const events: RunEventRow[] = [];
    if (reservations.length > 0) {
      for (let from = 0; ; from += PAGE) {
        const ev = await db
          .from('usage_events')
          .select('reservation_id, kind, billable_tokens')
          .eq('user_id', userId)
          .in(
            'reservation_id',
            reservations.map((r) => r.id),
          )
          .order('id')
          .range(from, from + PAGE - 1);
        if (ev.error) throw new Error(ev.error.message);
        events.push(...((ev.data ?? []) as RunEventRow[]));
        if ((ev.data ?? []).length < PAGE) break;
      }
    }
    return runCharge(reservations, events);
  } catch (err) {
    console.error('[clips] run charge read failed:', err);
    return null;
  }
}
