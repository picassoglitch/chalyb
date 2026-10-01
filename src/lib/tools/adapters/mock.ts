// In-memory Clips adapter for tests, local development and previews
// (TOOL_HUB_MODE_CHALYBCLIP=mock). Nothing leaves the process and no credits
// move: it exists so the hub's Clips screens and the job policy can be
// exercised end to end before the engine's job API exists (OPS-13).
//
// Jobs advance on the clock, one state per `stepMs`. The pasted link picks a
// scenario, so e2e specs can reach every screen:
//
//   …private…        → fails with link_private once the video is read
//   …toolong…        → fails with video_too_long
//   …nocredits…      → refused at submit with no_credits
//   …platformdown…   → every attempt fails with platform_down
//   …flaky…          → the first attempt fails with platform_down, then works
//   anything else    → ready, with `count` clips

import type {
  Clip,
  ClipFailureReason,
  ClipJob,
  ClipJobState,
  ClipsAdapter,
  CreateClipJobInput,
  CreateClipJobResult,
} from './types';

interface StoredJob {
  job: Omit<ClipJob, 'state' | 'reason' | 'momentsFound' | 'clips'>;
  attemptStartedMs: number;
}

const PROGRESS: ClipJobState[] = ['received', 'finding_moments', 'adding_captions', 'ready'];

export interface MockClipsOptions {
  now?: () => number;
  stepMs?: number;
  newId?: () => string;
}

export function createMockClipsAdapter(options: MockClipsOptions = {}): ClipsAdapter {
  const now = options.now ?? (() => Date.now());
  const stepMs = options.stepMs ?? 1500;
  let counter = 0;
  const newId = options.newId ?? (() => `mock_${now().toString(36)}_${(counter++).toString(36)}`);
  const jobs = new Map<string, StoredJob>();

  function scenario(url: string): { failAt: ClipJobState; reason: ClipFailureReason } | null {
    const u = url.toLowerCase();
    if (u.includes('private')) return { failAt: 'finding_moments', reason: 'link_private' };
    if (u.includes('toolong')) return { failAt: 'finding_moments', reason: 'video_too_long' };
    if (u.includes('platformdown')) return { failAt: 'received', reason: 'platform_down' };
    return null;
  }

  function view(stored: StoredJob): ClipJob {
    const { job } = stored;
    const step = Math.floor((now() - stored.attemptStartedMs) / stepMs);
    let failure = scenario(job.sourceUrl);
    if (job.sourceUrl.toLowerCase().includes('flaky') && job.attempts === 1) {
      failure = { failAt: 'received', reason: 'platform_down' };
    }
    const reached = PROGRESS[Math.min(step, PROGRESS.length - 1)]!;

    if (failure && PROGRESS.indexOf(reached) > PROGRESS.indexOf(failure.failAt)) {
      return { ...job, state: 'failed', reason: failure.reason, momentsFound: null, clips: [] };
    }
    const found = PROGRESS.indexOf(reached) >= PROGRESS.indexOf('adding_captions');
    return {
      ...job,
      state: reached,
      momentsFound: found ? job.count : null,
      clips: reached === 'ready' ? makeClips(job.id, job.count) : [],
    };
  }

  return {
    async createJob(input: CreateClipJobInput): Promise<CreateClipJobResult> {
      if (input.sourceUrl.toLowerCase().includes('nocredits'))
        return { ok: false, reason: 'no_credits' };
      const id = newId();
      jobs.set(id, {
        job: {
          id,
          userId: input.userId,
          sourceUrl: input.sourceUrl,
          format: input.format,
          count: input.count,
          attempts: 1,
          settled: false,
          createdAt: new Date(now()).toISOString(),
        },
        attemptStartedMs: now(),
      });
      return { ok: true, jobId: id };
    },

    async getJob(userId, jobId) {
      const stored = jobs.get(jobId);
      if (!stored || stored.job.userId !== userId) return null;
      return view(stored);
    },

    async retryJob(userId, jobId) {
      const stored = jobs.get(jobId);
      if (!stored || stored.job.userId !== userId) return;
      stored.job = { ...stored.job, attempts: stored.job.attempts + 1 };
      stored.attemptStartedMs = now();
    },

    async markSettled(userId, jobId) {
      const stored = jobs.get(jobId);
      if (!stored || stored.job.userId !== userId || stored.job.settled) return false;
      stored.job = { ...stored.job, settled: true };
      return true;
    },
  };
}

function makeClips(jobId: string, count: number): Clip[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${jobId}_${i + 1}`,
    title: `Clip ${i + 1}`,
    durationSec: 15 + ((i * 7) % 46),
    downloadUrl: `/api/clips/mock/${encodeURIComponent(jobId)}/${i + 1}`,
  }));
}
