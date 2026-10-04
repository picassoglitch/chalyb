// WS-11 · Clips inside the app (TOOLS-SPEC §4): the pure rules the screens
// and the BFF share, and the mock adapter's clip-level contract.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampTrim,
  cleanTitle,
  clipNeighbours,
  filterClips,
  isValidTrim,
  jobProgress,
  mmss,
  nudge,
  parseClipFilter,
  processingRows,
  relativeDay,
  TITLE_MAX,
} from '@/lib/tools/clips-home';
import { parseClipPatch, parsePlatform, parseSettings } from '@/lib/tools/clips-bff';
import { createMockClipsAdapter } from '@/lib/tools/adapters/mock';
import { DEFAULT_CLIPS_SETTINGS, type ClipDetail, type ClipJob } from '@/lib/tools/adapters/types';

test('job progress: 4 named steps and the percent the row shows', () => {
  assert.deepEqual(jobProgress('received'), { step: 1, key: 'receiving', pct: 10 });
  assert.deepEqual(jobProgress('finding_moments'), { step: 2, key: 'finding', pct: 40 });
  assert.deepEqual(jobProgress('adding_captions'), { step: 3, key: 'captions', pct: 68 });
  assert.deepEqual(jobProgress('ready'), { step: 4, key: 'preparing', pct: 100 });
});

test('En proceso: at most 3 rows, the rest as "y {n} más"; ready jobs never show', () => {
  const job = (id: string, state: ClipJob['state']) => ({ id, state }) as ClipJob;
  const jobs = [
    job('a', 'received'),
    job('b', 'ready'),
    job('c', 'failed'),
    job('d', 'adding_captions'),
    job('e', 'finding_moments'),
  ];
  const { rows, more } = processingRows(jobs);
  assert.deepEqual(
    rows.map((r) => r.id),
    ['a', 'c', 'd'],
  );
  assert.equal(more, 1);
  assert.deepEqual(processingRows([job('x', 'ready')]), { rows: [], more: 0 });
});

test('trim: inside the clip, at least 5 s, the other handle stays put', () => {
  assert.deepEqual(clampTrim({ startS: 3, endS: 42 }, 45), { startS: 3, endS: 42 });
  assert.deepEqual(clampTrim({ startS: -2, endS: 99 }, 45), { startS: 0, endS: 45 });
  // Moving the end too close pushes it back out to 5 s after the start.
  assert.deepEqual(clampTrim({ startS: 10, endS: 12 }, 45, 'end'), { startS: 10, endS: 15 });
  // Moving the start too close stops it 5 s before the end.
  assert.deepEqual(clampTrim({ startS: 41, endS: 42 }, 45, 'start'), { startS: 37, endS: 42 });
  // At the very end, the start gives way.
  assert.deepEqual(clampTrim({ startS: 44, endS: 45 }, 45, 'end'), { startS: 40, endS: 45 });
  // A clip shorter than 5 s keeps its whole length.
  assert.deepEqual(clampTrim({ startS: 1, endS: 2 }, 4), { startS: 0, endS: 4 });
  // Tenths of a second, no float noise.
  assert.deepEqual(clampTrim({ startS: 0.1 + 0.2, endS: 20 }, 45), { startS: 0.3, endS: 20 });
  assert.ok(isValidTrim({ startS: 0, endS: 45 }, 45));
  assert.ok(!isValidTrim({ startS: 10, endS: 11 }, 45));
  assert.ok(!isValidTrim({ startS: '0', endS: 4 }, 45));
});

test('trim keyboard: ← → 0.1 s, Shift 1 s, other keys nothing', () => {
  assert.equal(nudge('ArrowLeft', false), -0.1);
  assert.equal(nudge('ArrowRight', false), 0.1);
  assert.equal(nudge('ArrowRight', true), 1);
  assert.equal(nudge('ArrowLeft', true), -1);
  assert.equal(nudge('Enter', false), 0);
});

test('title: trimmed, collapsed, at most 100 characters, never empty', () => {
  assert.equal(cleanTitle('  Mi   mejor  clip '), 'Mi mejor clip');
  assert.equal(cleanTitle('x'.repeat(150))!.length, TITLE_MAX);
  assert.equal(cleanTitle('   '), null);
});

test('mm:ss and relative days in Mexico City', () => {
  assert.equal(mmss(42), '0:42');
  assert.equal(mmss(63.4), '1:03');
  assert.equal(mmss(-3), '0:00');
  const now = new Date('2026-10-03T18:00:00Z'); // 12:00 in CDMX
  assert.equal(relativeDay('2026-10-03T15:00:00Z', now, 'es'), 'Hoy');
  assert.equal(relativeDay('2026-10-02T15:00:00Z', now, 'es'), 'Ayer');
  assert.equal(relativeDay('2026-10-02T15:00:00Z', now, 'en'), 'Yesterday');
  // 03:00 UTC on the 3rd is still the 2nd in Mexico City.
  assert.equal(relativeDay('2026-10-03T03:00:00Z', now, 'es'), 'Ayer');
});

const clip = (id: string, title: string, format: ClipDetail['format']) =>
  ({ id, title, format }) as ClipDetail;

test('Mis clips: format chips and search, unknown filter is Todos', () => {
  const all = [clip('1', 'La jugada final', 'vertical'), clip('2', 'Reacción épica', 'square')];
  assert.deepEqual(
    filterClips(all, 'all', '').map((c) => c.id),
    ['1', '2'],
  );
  assert.deepEqual(
    filterClips(all, 'square', '').map((c) => c.id),
    ['2'],
  );
  assert.deepEqual(
    filterClips(all, 'all', 'JUGADA').map((c) => c.id),
    ['1'],
  );
  assert.equal(parseClipFilter('horizontal'), 'horizontal');
  assert.equal(parseClipFilter('<script>'), 'all');
  assert.deepEqual(clipNeighbours(all, '2'), { n: 2, total: 2, prev: '1', next: null });
  assert.equal(clipNeighbours(all, 'nope'), null);
});

test('BFF parsing: only values a screen could send reach the adapter', () => {
  const patch = parseClipPatch(
    {
      title: '  Nuevo  ',
      captionsOn: false,
      format: 'square',
      trim: { startS: 40, endS: 41 },
      userId: 'x',
    },
    { sourceDurationSec: 45 },
  );
  assert.deepEqual(patch, {
    title: 'Nuevo',
    captionsOn: false,
    format: 'square',
    trim: { startS: 40, endS: 45 },
  });
  assert.deepEqual(
    parseClipPatch({ title: '', format: 'tall', captionsOn: 'yes' }, { sourceDurationSec: 45 }),
    {},
  );
  assert.deepEqual(parseClipPatch(null, { sourceDurationSec: 45 }), {});

  const s = parseSettings(
    {
      captionPreset: 'fondo',
      duration: 90,
      framing: 'follow',
      captionLang: 'fr',
      watermarkOn: true,
    },
    DEFAULT_CLIPS_SETTINGS,
  );
  assert.equal(s.captionPreset, 'fondo');
  assert.equal(s.duration, 'auto', 'out of 15–60 is dropped');
  assert.equal(s.framing, 'follow');
  assert.equal(s.captionLang, 'es');
  assert.equal(parseSettings({ duration: 30 }, DEFAULT_CLIPS_SETTINGS).duration, 30);
  assert.equal(DEFAULT_CLIPS_SETTINGS.captionPreset, 'amarillo', 'Amarillo is the default (§3)');
  assert.equal(parsePlatform('tiktok'), 'tiktok');
  assert.equal(parsePlatform('myspace'), null);
});

test('mock adapter: finished clips, edits keep the original, others can’t read them', async () => {
  let t = 0;
  const a = createMockClipsAdapter({ now: () => t, stepMs: 10 });
  const r = await a.createJob({
    userId: 'u1',
    sourceUrl: 'https://youtube.com/watch?v=torneo-del-sabado',
    format: 'vertical',
    count: 3,
  });
  assert.ok(r.ok);
  assert.equal((await a.listClips('u1')).length, 0, 'no clips while working');
  const working = await a.getJob('u1', r.jobId);
  assert.equal(working!.title, 'torneo del sabado');
  assert.ok(working!.etaMinutes! > 0);
  t = 100;
  const clips = await a.listClips('u1');
  assert.equal(clips.length, 3);
  const first = clips[0]!;
  assert.deepEqual(first.trim, { startS: 0, endS: first.sourceDurationSec });
  const edited = await a.patchClip('u1', first.id, {
    title: 'Nuevo',
    trim: { startS: 2, endS: 9 },
  });
  assert.equal(edited!.title, 'Nuevo');
  assert.equal(edited!.sourceDurationSec, first.sourceDurationSec, 'the original length stays');
  assert.equal(await a.getClip('u2', first.id), null);
  assert.equal(await a.patchClip('u2', first.id, { title: 'x' }), null);
  assert.deepEqual(await a.getSettings('u1'), DEFAULT_CLIPS_SETTINGS);
  await a.saveSettings('u1', { ...DEFAULT_CLIPS_SETTINGS, captionPreset: 'fondo' });
  assert.equal((await a.getSettings('u1')).captionPreset, 'fondo');
  assert.deepEqual(await a.accounts('u1'), [], 'no accounts without supportsConnect');
  assert.equal(await a.connectUrl('u1', 'tiktok', '/app/clips'), null);
});

// Review fix 2: connecting socials and publishing follow TIER_CAPS.
import { socialsAllowed } from '@/lib/tools/clips-bff';
import { failureEffect as failure, statusForReason as status } from '@/lib/tools/bff-core';

test('social connect and publish: only plans with clipConnectSocials', () => {
  assert.equal(socialsAllowed('FREE'), false);
  assert.equal(socialsAllowed('PRO'), true);
  assert.equal(socialsAllowed('VIP'), true);
  const refusal = failure({ code: 'NEEDS_PLAN' }, { adapterErrorsOnly: true });
  assert.deepEqual(refusal, { reason: 'needs_plan', retryable: false, outage: false });
  assert.equal(status('needs_plan'), 403);
});
