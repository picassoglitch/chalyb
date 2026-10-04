// Clip jobs hidden by a copyright removal (Uso aceptable §5.2; 7a review of
// #49, HIGH 3). Every place the hub serves a job reads this: Mis
// resultados, the job page (and so its download and share buttons) and the
// mock download route. A restore (counter-notice upheld) un-hides them.
//
// The real Clips engine has no delete call yet (OPS-13): files it already
// produced stay at the engine; the hub stops showing, linking or serving
// them, and the emails say exactly that.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export async function hiddenJobIds(userId: string): Promise<Set<string>> {
  const { data, error } = await createAdminClient()
    .from('content_removals')
    .select('job_id')
    .eq('user_id', userId)
    .is('restored_at', null);
  if (error) {
    // Before 0056 runs the table doesn't exist: nothing is hidden yet.
    console.error('[removals] lookup failed', error.message);
    return new Set();
  }
  return new Set(((data ?? []) as { job_id: string }[]).map((r) => r.job_id));
}

export async function isJobHidden(userId: string, jobId: string): Promise<boolean> {
  return (await hiddenJobIds(userId)).has(jobId);
}
