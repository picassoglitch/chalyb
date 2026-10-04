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

import {
  DEFAULT_CLIPS_SETTINGS,
  type Clip,
  type ClipDetail,
  type ClipFailureReason,
  type ClipJob,
  type ClipJobState,
  type ClipPatch,
  type ClipsAdapter,
  type ClipsSettings,
  type CreateClipJobInput,
  type CreateClipJobResult,
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
  /** The person's edits per clip (the original is never touched). */
  const edits = new Map<string, ClipPatch>();
  const settings = new Map<string, ClipsSettings>();

  function detail(job: ClipJob, clip: Clip): ClipDetail {
    const e = edits.get(clip.id) ?? {};
    return {
      id: clip.id,
      jobId: job.id,
      title: e.title ?? clip.title,
      sourceDurationSec: clip.durationSec,
      format: e.format ?? job.format,
      captionsOn: e.captionsOn ?? true,
      trim: e.trim ?? { startS: 0, endS: clip.durationSec },
      createdAt: job.createdAt,
      downloadUrl: clip.downloadUrl,
      thumbUrl: null,
      previewUrl: null,
    };
  }

  function readyClips(userId: string): ClipDetail[] {
    return [...jobs.values()]
      .filter((s) => s.job.userId === userId)
      .map(view)
      .filter((j) => j.state === 'ready')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .flatMap((j) => j.clips.map((c) => detail(j, c)));
  }

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
    const left = PROGRESS.length - 1 - PROGRESS.indexOf(reached);
    return {
      ...job,
      etaMinutes: left > 0 ? left : undefined,
      state: reached,
      momentsFound: found ? job.count : null,
      clips: reached === 'ready' ? makeClips(job.id, job.count) : [],
    };
  }

  return {
    capabilities: () => ({
      sources: ['YouTube', 'Twitch', 'Kick', 'Facebook'],
      bulkUpload: true,
      captionStyles: true,
      customDuration: true,
      watermark: false,
      fileUpload: false,
      supportsConnect: false,
      confirmsNoChargeOnFailure: true,
      editClips: true,
      framing: true,
      apiAccess: false,
    }),

    async createJob(input: CreateClipJobInput): Promise<CreateClipJobResult> {
      if (input.sourceUrl.toLowerCase().includes('nocredits'))
        return { ok: false, reason: 'no_credits' };
      const id = newId();
      jobs.set(id, {
        job: {
          id,
          userId: input.userId,
          sourceUrl: input.sourceUrl,
          title: titleFrom(input.sourceUrl),
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

    async listJobs(userId, limit = 50) {
      return [...jobs.values()]
        .filter((s) => s.job.userId === userId)
        .map(view)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
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

    async listClips(userId, limit = 200) {
      return readyClips(userId).slice(0, limit);
    },

    async getClip(userId, clipId) {
      return readyClips(userId).find((c) => c.id === clipId) ?? null;
    },

    async patchClip(userId, clipId, patch) {
      const clip = readyClips(userId).find((c) => c.id === clipId);
      if (!clip) return null;
      edits.set(clipId, { ...(edits.get(clipId) ?? {}), ...patch });
      return readyClips(userId).find((c) => c.id === clipId) ?? null;
    },

    async getSettings(userId) {
      return settings.get(userId) ?? DEFAULT_CLIPS_SETTINGS;
    },

    async saveSettings(userId, next) {
      settings.set(userId, next);
    },

    // No account connection without an engine API (supportsConnect=false).
    async accounts() {
      return [];
    },
    async connectUrl() {
      return null;
    },
    async publishClip() {
      return { ok: false };
    },
  };
}

/** "…watch?v=torneo-del-sabado" → "torneo del sabado"; undefined otherwise. */
function titleFrom(url: string): string | undefined {
  try {
    const u = new URL(url);
    const v = u.searchParams.get('v') ?? u.pathname.split('/').filter(Boolean).pop();
    return v ? v.replace(/[-_]+/g, ' ').slice(0, 60) : undefined;
  } catch {
    return undefined;
  }
}

/** Sample titles for the mock's clips (development and previews only). */
const MOCK_TITLES = [
  'El mejor momento del stream',
  'Reacción épica',
  'La jugada final',
  'Respondiendo al chat',
  'Risa con los amigos',
  'El consejo del día',
];

function makeClips(jobId: string, count: number): Clip[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${jobId}_${i + 1}`,
    title: MOCK_TITLES[i % MOCK_TITLES.length]!,
    durationSec: 15 + ((i * 7) % 46),
    downloadUrl: `/api/clips/mock/${encodeURIComponent(jobId)}/${i + 1}`,
  }));
}
