// Owner 2026-11-07: Gratis = 1 video a month up to 5 minutes. The upload
// screen refuses a longer file before it moves, in the plan's words.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTranslator } from 'next-intl';
import { ToolCallError, type ErrorCopy } from '@/components/tools/clips/engine/tool-call';
import { overLength, uploadErrorText } from '@/components/tools/clips/engine/upload-limits';
import { uploadPlanLimits } from '@/lib/tools/clips-plan-limits';

const es = JSON.parse(readFileSync('messages/es.json', 'utf8'));
const en = JSON.parse(readFileSync('messages/en.json', 'utf8'));
const t = (messages: unknown) =>
  createTranslator({ locale: 'es', messages: messages as never, namespace: 'clipsEngine.upload.limits' as never });

const errors = es.clipsEngine.errors as ErrorCopy;

test('Gratis: 5 minutes and 1 video; paid plans have no per-video cap here; admins none', () => {
  assert.deepEqual(uploadPlanLimits({ role: 'VIEWER', tier: 'FREE' }), {
    free: true,
    maxMinutes: 5,
    videosPerMonth: 1,
  });
  assert.deepEqual(uploadPlanLimits({ role: 'VIEWER', tier: 'PRO' }), {
    free: false,
    maxMinutes: 180,
    videosPerMonth: null,
  });
  assert.deepEqual(uploadPlanLimits({ role: 'ADMIN', tier: 'FREE' }), {
    free: false,
    maxMinutes: null,
    videosPerMonth: null,
  });
});

test('a 6-minute file is over Gratis, a 5-minute one is not, an unknown length goes to the engine', () => {
  assert.equal(overLength(6 * 60, 5 * 60), true);
  assert.equal(overLength(5 * 60, 5 * 60), false);
  assert.equal(overLength(null, 5 * 60), false);
  assert.equal(overLength(6 * 60, null), false);
});

test('refusals read in the plan words', () => {
  const tr = t(es) as unknown as (k: string, v: Record<string, number>) => string;
  const limits = {
    tooLong: tr('tooLongFree', { min: 5 }),
    monthUsed: tr('monthUsedFree', { videos: 1 }),
  };
  assert.equal(
    limits.tooLong,
    'Tu plan Gratis permite videos de hasta 5 minutos. Recórtalo o mejora tu plan.',
  );
  assert.match(limits.monthUsed, /^Tu plan Gratis incluye 1 video al mes/);
  const tooLong = new ToolCallError('too_large', null, 'video_too_long');
  const used = new ToolCallError('rate_limited', null, 'videos_cap');
  const other = new ToolCallError('rate_limited', null, 'minutes_cap');
  assert.equal(uploadErrorText(tooLong, errors, limits), limits.tooLong);
  assert.equal(uploadErrorText(used, errors, limits), limits.monthUsed);
  assert.equal(uploadErrorText(other, errors, limits), errors.rate_limited);
  // No plan limit to state: the generic copy.
  assert.equal(
    uploadErrorText(tooLong, errors, { tooLong: null, monthUsed: null }),
    errors.too_large,
  );
  const tren = t(en) as unknown as (k: string, v: Record<string, number>) => string;
  assert.match(tren('tooLongFree', { min: 5 }), /^Your Free plan takes videos up to 5 minutes/);
});
