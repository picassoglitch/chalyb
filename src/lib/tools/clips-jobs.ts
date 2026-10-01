// Server-side wiring of the Clips job policy (adapters/run-job.ts) to the
// real adapter, the audit log and the credit ledger.

import 'server-only';
import { logAudit } from '@/lib/audit/log';
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
