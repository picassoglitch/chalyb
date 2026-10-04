// Copyright removals do something (7a review of #49, HIGH 3 and 4): the
// uploader's matching jobs are hidden wherever the hub serves them, a
// restore undoes it, the block uses an exact source the admin picked and
// saw normalized, and concurrent clicks can't double-act.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const server = () => read('src/lib/legal/legal-server.ts');

test('H3 · a removed job is hidden from Mis resultados, its page (downloads, sharing) and the download route', () => {
  assert.match(
    read('src/lib/results/collect.ts'),
    /jobs\.filter\(\(j\) => !hidden\.has\(j\.id\)\)/,
  );
  assert.match(
    read('src/lib/tools/clips-jobs.ts'),
    /if \(await isJobHidden\(userId, jobId\)\) return null;/,
  );
  assert.match(
    read('src/app/api/clips/mock/[job]/[n]/route.ts'),
    /if \(await isJobHidden\(session\.user\.id, jobId\)\)/,
  );
  assert.match(
    read('src/lib/legal/removals.ts'),
    /\.from\('content_removals'\)[\s\S]*\.is\('restored_at', null\)/,
  );
});

test('H3 · removal stores the hidden job ids; restore undoes exactly that', () => {
  const s = server();
  assert.match(s, /\.from\('content_removals'\)\s*\.upsert\(\s*matches\.map\(/);
  assert.match(s, /removed_job_count: matches\.length/);
  assert.match(
    s,
    /\.from\('content_removals'\)\s*\.update\(\{ restored_at: now \}\)\s*\.eq\('takedown_id', id\)/,
  );
  // The email says what was done, not that content was deleted.
  assert.match(s, /Lo que hicimos: ocultamos/);
  assert.match(s, /no los podemos tocar/);
});

test('H4 · the block uses an exact source that normalizes and matches one of the uploader’s jobs', () => {
  const s = server();
  assert.match(s, /input: \{ targetEmail: string; sourceUrl: string \}/);
  assert.match(s, /if \(!normalized \|\| !fp\) return \{ ok: false, code: 'source' \};/);
  assert.match(s, /if \(!matches\.length\) return \{ ok: false, code: 'no_job' \};/);
  assert.doesNotMatch(s, /contentFingerprint\(n\.content_location/, 'never the notice’s free text');
  const api = read('src/app/api/admin/legal/route.ts');
  assert.match(api, /b\.action === 'lookup'/);
  assert.match(api, /b\.action === 'preview'/);
  const ui = read('src/components/dashboard/admin/legal-actions.tsx');
  assert.match(
    ui,
    /disabled=\{busy \|\| !normalized\}/,
    'Retirar only after the normalized source is shown',
  );
});

test('LOW · exact email lookup; guarded updates stop when someone else moved first', () => {
  const s = server();
  assert.match(s, /\.eq\('email', email\.trim\(\)\.toLowerCase\(\)\)/);
  assert.doesNotMatch(s, /\.ilike\('email'/);
  assert.match(
    s,
    /\.eq\('status', 'received'\)\s*\.select\('id, content_identification, right_statement'\)\s*\.maybeSingle\(\);\s*\/\/ Someone else moved it first/,
  );
  assert.match(s, /\.eq\('status', 'removed'\)\s*\.select\('id'\)\s*\.maybeSingle\(\);/);
  assert.match(
    s,
    /\.eq\('status', 'counter_noticed'\)\s*\.select\('id'\)\s*\.maybeSingle\(\);\s*\/\/ Already restored/,
  );
});

test('LOW · reject needs a reason, in its own field', () => {
  const ui = read('src/components/dashboard/admin/legal-actions.tsx');
  assert.match(ui, /disabled=\{busy \|\| !reason\.trim\(\)\}/);
  assert.match(
    read('src/app/api/admin/legal/route.ts'),
    /str\('reason'\)\.trim\(\) \? await rejectTakedown/,
  );
});
