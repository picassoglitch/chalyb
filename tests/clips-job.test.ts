// Clips job policy (P0-16, BUILD-SPEC §4.2.3–6).

import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockClipsAdapter } from '@/lib/tools/adapters/mock';
import {
  MAX_AUTO_RETRIES,
  checkSourceUrl,
  refreshClipJob,
  submitClipJob,
  type JobPolicyDeps,
} from '@/lib/tools/adapters/run-job';
import { creditsRenewDate, platformName } from '@/lib/tools/clips-copy';

function harness() {
  let clock = 0;
  const adapter = createMockClipsAdapter({ now: () => clock, stepMs: 10 });
  const debits: string[] = [];
  const failures: string[] = [];
  const deps: JobPolicyDeps = {
    adapter,
    debit: async (job) => {
      debits.push(job.id);
    },
    logFailure: ({ reason }) => failures.push(reason),
  };
  return { deps, debits, failures, tick: (ms: number) => (clock += ms) };
}

const input = (sourceUrl: string) => ({
  userId: 'u1',
  sourceUrl,
  format: 'vertical' as const,
  count: 6 as const,
});

test('states go received → finding_moments → adding_captions → ready', async () => {
  const h = harness();
  const created = await submitClipJob(h.deps, input('https://youtube.com/watch?v=ok'));
  assert.ok(created.ok);
  const seen: string[] = [];
  for (let i = 0; i < 4; i++) {
    seen.push((await refreshClipJob(h.deps, 'u1', created.jobId))!.state);
    h.tick(10);
  }
  assert.deepEqual(seen, ['received', 'finding_moments', 'adding_captions', 'ready']);
});

test('credits are charged once, on success only', async () => {
  const h = harness();
  const created = await submitClipJob(h.deps, input('https://youtube.com/watch?v=ok'));
  assert.ok(created.ok);
  h.tick(100);
  const job = await refreshClipJob(h.deps, 'u1', created.jobId);
  await refreshClipJob(h.deps, 'u1', created.jobId);
  await Promise.all([
    refreshClipJob(h.deps, 'u1', created.jobId),
    refreshClipJob(h.deps, 'u1', created.jobId),
  ]);
  assert.equal(job!.state, 'ready');
  assert.equal(job!.clips.length, 6);
  assert.deepEqual(h.debits, [created.jobId]);
});

test('a failed job charges nothing and logs its reason once', async () => {
  const h = harness();
  const created = await submitClipJob(h.deps, input('https://youtube.com/watch?v=private'));
  assert.ok(created.ok);
  h.tick(100);
  const job = await refreshClipJob(h.deps, 'u1', created.jobId);
  await refreshClipJob(h.deps, 'u1', created.jobId);
  assert.equal(job!.state, 'failed');
  assert.equal(job!.reason, 'link_private');
  assert.deepEqual(h.debits, []);
  assert.deepEqual(h.failures, ['link_private']);
});

test(`transient failures retry ${MAX_AUTO_RETRIES} times, then show the error`, async () => {
  const h = harness();
  const created = await submitClipJob(h.deps, input('https://twitch.tv/videos/platformdown'));
  assert.ok(created.ok);
  let job;
  for (let i = 0; i < 10; i++) {
    h.tick(20);
    job = await refreshClipJob(h.deps, 'u1', created.jobId);
    if (job?.state === 'failed') break;
  }
  assert.equal(job!.state, 'failed');
  assert.equal(job!.reason, 'platform_down');
  assert.equal(job!.attempts, 1 + MAX_AUTO_RETRIES);
  assert.deepEqual(h.debits, []);
});

test('a transient failure that recovers ends ready', async () => {
  const h = harness();
  const created = await submitClipJob(h.deps, input('https://kick.com/video/flaky'));
  assert.ok(created.ok);
  let job;
  for (let i = 0; i < 10; i++) {
    h.tick(20);
    job = await refreshClipJob(h.deps, 'u1', created.jobId);
    if (job?.state === 'ready') break;
  }
  assert.equal(job!.state, 'ready');
  assert.equal(job!.attempts, 2);
});

test('no credits is refused at submit and not retried', async () => {
  const h = harness();
  const result = await submitClipJob(h.deps, input('https://youtube.com/watch?v=nocredits'));
  assert.deepEqual(result, { ok: false, reason: 'no_credits' });
  assert.deepEqual(h.failures, ['no_credits']);
});

test('jobs are private to their owner', async () => {
  const h = harness();
  const created = await submitClipJob(h.deps, input('https://youtube.com/watch?v=ok'));
  assert.ok(created.ok);
  assert.equal(await refreshClipJob(h.deps, 'someone-else', created.jobId), null);
});

test('link check accepts the supported platforms only', () => {
  for (const ok of [
    'https://www.youtube.com/watch?v=1',
    'https://youtu.be/1',
    'https://m.twitch.tv/x',
    'https://kick.com/x',
    'https://fb.watch/x',
  ]) {
    assert.equal(checkSourceUrl(ok).ok, true, ok);
  }
  for (const bad of [
    'not a url',
    'ftp://youtube.com/x',
    'https://vimeo.com/1',
    'https://youtube.com.evil.example/x',
  ]) {
    assert.deepEqual(checkSourceUrl(bad), { ok: false, reason: 'link_unsupported' }, bad);
  }
});

test('copy helpers', () => {
  assert.equal(platformName('https://www.twitch.tv/x'), 'Twitch');
  assert.equal(platformName('https://vimeo.com/x'), null);
  // 23:30 on 31 Oct in Mexico City is already 1 Nov in UTC; still renews 1 Nov.
  assert.equal(creditsRenewDate(new Date('2026-11-01T05:30:00Z'), 'es'), '1 de noviembre de 2026');
  assert.equal(creditsRenewDate(new Date('2026-12-15T12:00:00Z'), 'es'), '1 de enero de 2027');
});
