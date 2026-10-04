// Server-side wiring of the Clips job policy (adapters/run-job.ts) to the
// real adapter, the audit log and the credit ledger.

import 'server-only';
import { logAudit } from '@/lib/audit/log';
import { addUserNotice, noticeText } from '@/lib/notifications/user';
import { createAdminClient } from '@/lib/supabase/admin';
import { track } from '@/lib/analytics/track';
import { getClipsAdapter } from './adapters/clips';
import { refreshClipJob, submitClipJob, type JobPolicyDeps } from './adapters/run-job';
import type { ClipJob, ClipsAdapter, CreateClipJobInput } from './adapters/types';

function policyDeps(adapter: ClipsAdapter): JobPolicyDeps {
  return {
    adapter,
    async debit(job) {
      // The mock adapter moves no credits. With the engine adapter (OPS-13)
      // the engine reports usage through /api/engines/chalybclip/usage, which
      // already writes the ledger — this is where a hub-side charge would go
      // if the job API leaves charging to the hub.
      console.info(`[clips] job ${job.id} ready · ${job.clips.length} clips · credits settled`);
      // first_clip (§6.5): the user's first finished job. Deduped by the
      // clips-ready notices: none yet means this is the first.
      const { count } = await createAdminClient()
        .from('user_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', job.userId)
        .eq('kind', 'clipsReady');
      if (!count) await track('first_clip', { clips: job.clips.length, format: job.format });
      await addUserNotice({
        userId: job.userId,
        kind: 'clipsReady',
        ...(await noticeText('clipsReady', { n: job.clips.length })),
        href: `/app/clips/trabajo/${encodeURIComponent(job.id)}`,
        dedupeKey: `clips:${job.id}`,
      });
    },
    logFailure({ id, userId, reason, attempts }) {
      console.error(
        `[clips] job ${id ?? '(not created)'} failed · ${reason} · attempts=${attempts}`,
      );
      void logAudit({
        action: 'clips.job_failed',
        actorId: userId,
        targetUserId: userId,
        metadata: { job_id: id, reason, attempts },
      });
    },
  };
}

export async function submitClips(input: CreateClipJobInput) {
  const adapter = getClipsAdapter();
  if (!adapter) return null;
  return submitClipJob(policyDeps(adapter), input);
}

export async function loadClipJob(userId: string, jobId: string): Promise<ClipJob | null> {
  const adapter = getClipsAdapter();
  if (!adapter) return null;
  return refreshClipJob(policyDeps(adapter), userId, jobId);
}

/** The user's jobs for Clips' home, newest first. Unfinished ones re-run the
 *  job policy (automatic retries, credits once, failures logged), exactly
 *  like opening each job's screen would. */
export async function listClipJobs(userId: string, limit = 20): Promise<ClipJob[]> {
  const adapter = getClipsAdapter();
  if (!adapter) return [];
  const deps = policyDeps(adapter);
  const jobs = await adapter.listJobs(userId, limit);
  return Promise.all(
    jobs.map(async (j) => (j.settled ? j : ((await refreshClipJob(deps, userId, j.id)) ?? j))),
  );
}
