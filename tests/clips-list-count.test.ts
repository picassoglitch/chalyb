// QA 2026-11-07 (VIP): Mis clips and the video page said 1 clip, Inicio "Lo último" and
// Mis resultados said 0. Real engine adapter over a stubbed hub API, shaped like that video.

import test from 'node:test';
import assert from 'node:assert/strict';
import { clipsEngine, type ClipsEngineDeps } from '@/lib/tools/adapters/clips/client';
import { createEngineClipsAdapter } from '@/lib/tools/adapters/clips/adapter';
import { clipsMade } from '@/lib/tools/adapters/types';
import { clipItem, filterResults, mergeResults } from '@/lib/results/core';

const STREAM = 'str_01M6SWFE3ZZHZW50E9G8F6HHJ8';
const CLIP = 'clp_01M6SX0Q8T2B7K4D9F1H3J5L7N';

// One 20 s clip still waiting for review: listed by /clips, counted by /streams.
const clip = {
  id: CLIP, stream_id: STREAM, status: 'ready_for_review', start_s: 312, end_s: 332,
  duration_s: 20, created_at: '2026-11-07T04:05:12Z', viral_score: 0.71, why: null,
  publishability_status: null, title: null, format: 'vertical',
  media_url: `/api/hub/v1/media/clip/${CLIP}`, download_url: null, thumb_url: null,
};
const streamRow = {
  id: STREAM, title: null, channel: null, platform: 'youtube',
  vod_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', status: 'done', active: false,
  duration_s: 1260, created_at: '2026-11-07T03:58:40Z', is_live: false,
  clip_count: 1, ready_count: 0,
};

function engineFor(userId: string) {
  const deps: ClipsEngineDeps = {
    fetch: (async (input: string) => {
      const path = new URL(input).pathname.replace('/api/hub/v1', '');
      const json = (body: unknown) =>
        new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
      if (path === '/streams')
        return json({ streams: [{ ...streamRow, status_kind: 'complete', settled: true, thumb_url: null }] });
      if (path === '/clips') return json({ clips: [clip] });
      if (path === `/streams/${STREAM}`)
        return json({
          stream: streamRow,
          overview: { status_kind: 'complete', total_clips: 1, ready_count: 0, rejected_count: 0 },
          clips: [clip],
          progress: null,
          source_url: null,
        });
      return new Response('{}', { status: 404 });
    }) as unknown as typeof fetch,
    identity: async (id) => ({
      userId: id, email: 'vip@example.com', tenantId: 'ten_vip', tier: 'vip', baseUrl: 'https://clips.example',
    }),
    mint: () => 'tok',
    forget: () => {},
  };
  return clipsEngine(userId, deps);
}

const adapter = createEngineClipsAdapter(engineFor);

test('Inicio and Mis resultados count the clips a finished video made, like Mis clips', async () => {
  const mine = await adapter.listClips('u-vip');
  const jobs = await adapter.listJobs('u-vip');
  assert.equal(mine.length, 1);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]!.state, 'ready');
  // collectResults → clipItem: the "Lo último" card and every Mis resultados row.
  const items = mergeResults(jobs.map(clipItem));
  const latest = items[0]!;
  assert.ok(latest.kind === 'clips');
  assert.equal(latest.count, mine.length);
  assert.equal(filterResults(items, 'all', '').length, 1);
  assert.equal(filterResults(items, 'ready', '').length, 1);
  // Tus herramientas card ("N clips listos") sums the same rows.
  assert.equal(jobs.reduce((n, j) => n + clipsMade(j), 0), 1);
});

test('the video page and the list row agree on the count', async () => {
  const row = (await adapter.listJobs('u-vip'))[0]!;
  const detail = await adapter.getJob('u-vip', STREAM);
  assert.ok(detail);
  assert.equal(detail.clips.length, 1);
  assert.equal(clipsMade(detail), clipsMade(row));
  assert.deepEqual(clipItem(detail), clipItem(row));
});

test('without a known count (mock adapter jobs), the loaded clips are the count', () => {
  const clips = [{ id: 'c1', title: '', durationSec: 20, downloadUrl: '' }];
  assert.equal(clipsMade({ clips }), 1);
  assert.equal(clipsMade({ clips: [], clipCount: 0 }), 0);
  assert.equal(clipsMade({ clips: [], clipCount: 3 }), 3);
});
