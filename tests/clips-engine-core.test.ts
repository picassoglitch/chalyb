// Clips mode "a" core: engine streams → the job contract, refusal mapping at
// job creation, and the BFF input parsers (pure).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clipDetailFromEngine,
  createRefusalReason,
  ENGINE_CAPABILITIES,
  jobFromStream,
  reasonFromFailure,
  stateFromProgress,
} from '@/lib/tools/adapters/clips/core';
import { ClipsEngineError } from '@/lib/tools/adapters/clips/errors';
import type { EngineProgress, EngineStream } from '@/lib/tools/adapters/clips/engine-api';
import {
  parseId,
  parseKit,
  parsePersona,
  parseSourceAdd,
  parseSourcePatch,
  parseTicket,
  parseUploadStart,
} from '@/lib/tools/clips-engine-input';
import { submitClipJob, refreshClipJob } from '@/lib/tools/adapters/run-job';

const step = (name: string, status: string) =>
  ({
    name,
    status,
    duration_s: null,
    elapsed_s: null,
    skipped: false,
    note: '',
    error_kind: null,
  }) as EngineProgress['steps'][number];

const prog = (
  statuses: Record<string, string>,
  extra: Partial<EngineProgress> = {},
): EngineProgress => ({
  steps: ['ingest', 'analyze_video', 'diarize', 'transcribe', 'detect', 'cut'].map((n) =>
    step(n, statuses[n] ?? 'pending'),
  ),
  is_running: true,
  is_done: false,
  has_failed: false,
  is_abandoned: false,
  failure: null,
  in_flight: true,
  candidate_count: 3,
  clip_count: 0,
  can_rerun: false,
  ...extra,
});

test('engine progress → the 4 hub steps', () => {
  assert.equal(stateFromProgress(null, 'pending'), 'received');
  assert.equal(stateFromProgress(prog({ ingest: 'running' }), 'running'), 'received');
  assert.equal(
    stateFromProgress(prog({ ingest: 'done', analyze_video: 'running' }), 'running'),
    'finding_moments',
  );
  assert.equal(
    stateFromProgress(prog({ ingest: 'done', detect: 'done', cut: 'running' }), 'running'),
    'adding_captions',
  );
  assert.equal(stateFromProgress(null, 'complete'), 'ready');
  assert.equal(stateFromProgress(prog({}, { is_abandoned: true }), 'running'), 'failed');
  assert.equal(stateFromProgress(null, 'failed'), 'failed');
});

test('failure kinds → wizard reasons', () => {
  assert.equal(reasonFromFailure('source'), 'link_private');
  assert.equal(reasonFromFailure('too_long'), 'video_too_long');
  assert.equal(reasonFromFailure('persona'), 'no_persona');
  assert.equal(reasonFromFailure('other'), 'unknown');
  assert.equal(reasonFromFailure(null), 'unknown');
});

const stream = (over: Partial<EngineStream> = {}): EngineStream => ({
  id: 'str_1',
  title: 'Mi stream',
  channel: null,
  platform: 'kick',
  vod_url: 'https://kick.com/v',
  status: 'done',
  active: false,
  duration_s: 600,
  created_at: '2026-10-15T00:00:00Z',
  is_live: false,
  clip_count: 2,
  ready_count: 1,
  status_kind: 'complete',
  settled: true,
  ...over,
});

test('a stream is a job: same id, settled flag, failure reason from progress', () => {
  const j = jobFromStream('u1', stream());
  assert.equal(j.id, 'str_1');
  assert.equal(j.state, 'ready');
  assert.equal(j.settled, true);
  assert.equal(j.title, 'Mi stream');
  const f = jobFromStream('u1', stream({ status_kind: 'failed', settled: false }), {
    clips: [],
    progress: prog({ ingest: 'failed' }, { has_failed: true, failure: { kind: 'source' } }),
  });
  assert.equal(f.state, 'failed');
  assert.equal(f.reason, 'link_private');
  assert.equal(jobFromStream('u1', stream({ vod_url: null })).sourceUrl, '');
});

const c0 = () => ({
  id: 'c0',
  stream_id: 's0',
  status: 'cut',
  start_s: 0,
  end_s: 1,
  duration_s: 1,
  created_at: 'x',
  format: 'vertical' as const,
  viral_score: null,
  why: null,
  publishability_status: null,
  title: null,
  media_url: null,
  download_url: null,
  thumb_url: null,
});

test('engine clip without a hook is named by its place in the video', () => {
  const c = clipDetailFromEngine({
    id: 'c1',
    stream_id: 's1',
    status: 'cut',
    start_s: 70,
    end_s: 95,
    duration_s: 25,
    created_at: 'x',
    format: 'square',
    viral_score: 60,
    why: null,
    publishability_status: null,
    title: null,
    media_url: 'https://e/api/hub/media/clip/c1',
    download_url: 'https://e/dl',
    thumb_url: null,
  });
  assert.equal(c.title, '1:10 – 1:35');
  assert.equal(c.previewUrl, 'https://e/api/hub/media/clip/c1');
  assert.equal(c.jobId, 's1');
  assert.equal(c.format, 'square');
  assert.equal(clipDetailFromEngine({ ...c0(), format: 'nope' as never }).format, 'vertical');
});

test('job creation: refusals become reasons, engine trouble is thrown', () => {
  assert.equal(
    createRefusalReason(new ClipsEngineError('no_credits', 402, 'no_tokens')),
    'no_credits',
  );
  assert.equal(
    createRefusalReason(new ClipsEngineError('rate_limited', 429, 'minutes_cap')),
    'plan_limit',
  );
  assert.equal(
    createRefusalReason(new ClipsEngineError('too_large', 413, 'video_too_long')),
    'video_too_long',
  );
  assert.equal(
    createRefusalReason(new ClipsEngineError('bad_request', 400, 'link_unsupported')),
    'link_unsupported',
  );
  assert.equal(
    createRefusalReason(new ClipsEngineError('bad_request', 400, 'no_persona')),
    'no_persona',
  );
  assert.equal(
    createRefusalReason(new ClipsEngineError('forbidden', 423, 'tenant_paused')),
    'plan_limit',
  );
  assert.equal(createRefusalReason(new ClipsEngineError('internal', 500)), null);
  assert.equal(createRefusalReason(new Error('x')), null);
});

test('engine jobs are never resubmitted by the hub (autoRetry false)', async () => {
  let creates = 0;
  let retries = 0;
  const adapter = {
    capabilities: () => ENGINE_CAPABILITIES,
    createJob: async () => {
      creates++;
      return { ok: false as const, reason: 'unknown' as const };
    },
    getJob: async () => ({
      ...jobFromStream('u', stream({ status_kind: 'failed', settled: false })),
      reason: 'unknown' as const,
    }),
    retryJob: async () => {
      retries++;
    },
    markSettled: async () => true,
  };
  const deps = { adapter: adapter as never, debit: async () => {}, logFailure: () => {} };
  await submitClipJob(deps, {
    userId: 'u',
    sourceUrl: 'https://kick.com/v',
    format: 'vertical',
    count: 6,
  });
  assert.equal(creates, 1);
  await refreshClipJob(deps, 'u', 'str_1');
  assert.equal(retries, 0);
});

test('BFF input parsing refuses junk before the engine sees it', () => {
  assert.throws(() => parseId('../x'));
  assert.equal(parseId('str_01ABC'), 'str_01ABC');
  assert.deepEqual(
    parseUploadStart({
      filename: ' a.mp4 ',
      size_bytes: 10,
      content_type: 'VIDEO/MP4',
      boost: true,
    }),
    { filename: 'a.mp4', size_bytes: 10, content_type: 'video/mp4', persona_id: null, boost: true },
  );
  assert.throws(() =>
    parseUploadStart({ filename: 'a', size_bytes: 10, content_type: 'text/html' }),
  );
  assert.throws(() =>
    parseUploadStart({ filename: 'a', size_bytes: -1, content_type: 'video/mp4' }),
  );
  assert.throws(() => parseTicket({ ticket: 'nope' }));
  assert.equal(parseTicket({ ticket: `abc_-.${'a'.repeat(64)}` }), `abc_-.${'a'.repeat(64)}`);
  assert.throws(() => parseSourceAdd({ channel_url: 'javascript:alert(1)', persona_id: 'p' }));
  assert.throws(() =>
    parseSourceAdd({ channel_url: 'https://y.t/c', persona_id: 'p', platform: 'vimeo' }),
  );
  assert.equal(parseSourceAdd({ channel_url: 'https://y.t/c', persona_id: 'p' }).polls_per_day, 1);
  assert.throws(() => parseSourcePatch({}));
  assert.throws(() => parseSourcePatch({ polls_per_day: 500 }));
  assert.throws(() => parsePersona({ name: 'x', primary_language: 'es' }, false));
  assert.deepEqual(
    parsePersona(
      {
        id: 'g',
        name: 'G',
        primary_language: 'es',
        voice_prompt: 'v',
        target_languages: [' es ', ''],
      },
      true,
    ),
    {
      id: 'g',
      name: 'G',
      primary_language: 'es',
      voice_prompt: 'v',
      target_languages: ['es'],
      routing_tags: [],
    },
  );
  assert.throws(() => parseKit({ name: 'k', safety_preset: 'yolo' }));
  assert.throws(() => parseKit({ name: 'k', content_timezone: 'a b' }));
  assert.equal(parseKit({ name: 'k' }).show_chalybclip_outro, true);
});

test('engine mode lists exactly the networks publishing can connect', async () => {
  const { createEngineClipsAdapter } = await import('@/lib/tools/adapters/clips/adapter');
  const { CONNECT_PLATFORMS } = await import('@/lib/tools/adapters/clips/publish');
  const caps = createEngineClipsAdapter(() => ({}) as never).capabilities();
  assert.deepEqual(caps.connectPlatforms, CONNECT_PLATFORMS);
  assert.equal(caps.autoRetry, false);
});
