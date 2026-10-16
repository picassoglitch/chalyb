// Clips core methods over the engine's hub API: jobs (the engine's
// streams), the clip list, settings and capabilities. Owned by the Clips
// core workstream.
//
// A ClipJob IS an engine stream (same id). The job contract is the hub's
// simple view of it; the full stream (steps, clips, cost, actions) is read
// with engine-api.ts on the job's own page.

import 'server-only';
import { NotImplementedError } from '../tools';
import {
  DEFAULT_CLIPS_SETTINGS,
  type ClipDetail,
  type ClipFailureReason,
  type ClipJob,
  type ClipJobState,
  type ClipsAdapter,
  type ClipsCapabilities,
} from '../types';
import { mmss } from '../../clips-home';
import type { ClipsEngine } from './client';
import { ClipsEngineError } from './errors';
import {
  createUrlJob,
  getStart,
  getStream,
  listEngineClips,
  listStreams,
  rerunStream,
  settleStream,
  type EngineClip,
  type EngineProgress,
  type EngineStream,
  type EngineStreamDetail,
  type FailureKind,
} from './engine-api';

export type CoreMethods = Pick<
  ClipsAdapter,
  | 'capabilities'
  | 'createJob'
  | 'getJob'
  | 'listJobs'
  | 'retryJob'
  | 'markSettled'
  | 'listClips'
  | 'getSettings'
  | 'saveSettings'
>;

export const ENGINE_CAPABILITIES: ClipsCapabilities = {
  sources: ['YouTube', 'Twitch', 'Kick'],
  bulkUpload: false,
  captionStyles: false,
  customDuration: false,
  watermark: false,
  // The engine takes uploads (browser → bucket, /app/clips/subir).
  fileUpload: true,
  supportsConnect: false,
  // A failed run may already have used tokens (the engine meters what it
  // spent): never promise "no se usaron créditos" for engine jobs.
  confirmsNoChargeOnFailure: false,
  editClips: false,
  framing: false,
  apiAccess: false,
  // The engine's own recovery loop re-dispatches stuck runs, and every
  // run is admitted (and billed) on its own: the hub never resubmits.
  autoRetry: false,
};

// ── mapping (pure, exported for tests) ───────────────────────────────────

/** Which hub step a pipeline is on. */
export function stateFromProgress(
  p: EngineProgress | null,
  kind: string | undefined,
): ClipJobState {
  if (kind === 'complete') return 'ready';
  if (kind === 'failed') return 'failed';
  if (p) {
    if (p.is_done) return 'ready';
    if (p.has_failed || p.is_abandoned) return 'failed';
    const running = p.steps.find((s) => s.status === 'running');
    const done = new Set(p.steps.filter((s) => s.status === 'done').map((s) => s.name));
    if (running?.name === 'cut' || done.has('detect')) return 'adding_captions';
    if (running && running.name !== 'ingest') return 'finding_moments';
    if (done.has('ingest')) return 'finding_moments';
  }
  return 'received';
}

export function reasonFromFailure(kind: FailureKind | null | undefined): ClipFailureReason {
  switch (kind) {
    case 'source':
      return 'link_private';
    case 'too_long':
      return 'video_too_long';
    case 'persona':
      return 'no_persona';
    default:
      return 'unknown';
  }
}

function failureKindOf(p: EngineProgress): FailureKind | null {
  return p.failure?.kind ?? p.steps.find((s) => s.status === 'failed')?.error_kind ?? null;
}

export function jobFromStream(
  userId: string,
  s: EngineStream,
  detail?: Pick<EngineStreamDetail, 'clips' | 'progress'>,
): ClipJob {
  const progress = detail?.progress ?? null;
  const state = stateFromProgress(progress, s.status_kind);
  const job: ClipJob = {
    id: s.id,
    userId,
    sourceUrl: s.vod_url ?? '',
    format: 'vertical',
    // The engine picks how many clips a video gives; the contract wants a
    // number, so a finished job reports its real count (results/core.ts).
    count: 6,
    state,
    momentsFound: progress ? progress.candidate_count : null,
    clips: (detail?.clips ?? []).map((c) => ({
      id: c.id,
      title: c.title ?? '',
      durationSec: Math.round(c.duration_s),
      downloadUrl: c.download_url ?? '',
    })),
    attempts: 1,
    settled: Boolean(s.settled),
    createdAt: s.created_at,
  };
  if (s.title) job.title = s.title;
  if (state === 'failed')
    job.reason = progress ? reasonFromFailure(failureKindOf(progress)) : 'unknown';
  return job;
}

export function clipDetailFromEngine(c: EngineClip): ClipDetail {
  return {
    id: c.id,
    jobId: c.stream_id,
    // No hook written yet: the moment's place in the video names it.
    title: c.title ?? `${mmss(c.start_s)} – ${mmss(c.end_s)}`,
    sourceDurationSec: c.duration_s,
    format: 'vertical',
    captionsOn: true,
    trim: { startS: 0, endS: c.duration_s },
    createdAt: c.created_at,
    downloadUrl: c.download_url ?? '',
    thumbUrl: c.thumb_url,
    previewUrl: c.media_url,
  };
}

/** An engine refusal at job creation → the wizard's failure reason. Engine
 *  trouble (network, 5xx) is thrown: the tool error state shows it, and it's
 *  never retried (the job may already exist). */
export function createRefusalReason(err: unknown): ClipFailureReason | null {
  if (!(err instanceof ClipsEngineError)) return null;
  switch (err.engineCode) {
    case 'no_credits':
      return 'no_credits';
    case 'rate_limited':
    case 'needs_plan':
    case 'forbidden':
      return 'plan_limit';
    case 'too_large':
      return 'video_too_long';
    case 'bad_request':
      if (err.refusal === 'link_unsupported') return 'link_unsupported';
      if (err.refusal === 'no_persona' || err.refusal === 'unknown_persona') return 'no_persona';
      return null;
    default:
      return null;
  }
}

// ── methods ──────────────────────────────────────────────────────────────

export function coreMethods(engine: (userId: string) => ClipsEngine): CoreMethods {
  return {
    capabilities: () => ENGINE_CAPABILITIES,

    async createJob(input, signal) {
      try {
        const { stream_id } = await createUrlJob(
          engine(input.userId),
          { vod_url: input.sourceUrl, ...(input.boost ? { boost: true } : {}) },
          signal,
        );
        return { ok: true, jobId: stream_id };
      } catch (err) {
        const reason = createRefusalReason(err);
        if (reason) return { ok: false, reason };
        throw err;
      }
    },

    async getJob(userId, jobId, signal) {
      try {
        const d = await getStream(engine(userId), jobId, signal);
        return jobFromStream(userId, { ...d.stream, status_kind: d.overview.status_kind }, d);
      } catch (err) {
        if (err instanceof ClipsEngineError && err.engineCode === 'not_found') return null;
        throw err;
      }
    },

    async listJobs(userId, limit = 20, signal) {
      const streams = await listStreams(engine(userId), limit, signal);
      return streams.map((s) => jobFromStream(userId, s));
    },

    async retryJob(userId, jobId, _opts, signal) {
      const e = engine(userId);
      const start = await getStart(e, signal);
      if (!start.default_persona_id)
        throw new NotImplementedError('ClipsEngineAdapter.retryJob without a persona');
      await rerunStream(e, jobId, { persona_id: start.default_persona_id }, signal);
    },

    async markSettled(userId, jobId, signal) {
      const { first } = await settleStream(engine(userId), jobId, signal);
      return first;
    },

    async listClips(userId, limit = 60, signal) {
      return (await listEngineClips(engine(userId), limit, signal)).map(clipDetailFromEngine);
    },

    // The hub's simple "Ajustes" (captions on/lang/preset, watermark,
    // duration, framing) has no engine counterpart: in mode "a" the
    // settings screen shows the engine's real settings (styles, personas,
    // channels, live) instead, and this form isn't rendered.
    getSettings: async () => DEFAULT_CLIPS_SETTINGS,
    saveSettings: () => {
      throw new NotImplementedError('ClipsEngineAdapter.saveSettings');
    },
  };
}
