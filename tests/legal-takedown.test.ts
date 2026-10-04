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
  assert.match(s, /\.from\('content_removals'\)\s*\.upsert\(\s*plan\.hideJobIds\.map\(/);
  assert.match(s, /removed_job_count: plan\.hideJobIds\.length/);
  assert.match(
    s,
    /\.from\('content_removals'\)\s*\.update\(\{ restored_at: now \}\)\s*\.eq\('takedown_id', id\)/,
  );
  // The email says what was done (removalDoneText), not that content was deleted.
  assert.match(s, /Lo que hicimos: \$\{escapeHtml\(removalDoneText\(plan\)\)\}/);
});

test('H4 · the block uses an exact source that normalizes (and hides the uploader’s matching jobs when the hub sees them)', () => {
  const s = server();
  assert.match(s, /input: \{ targetEmail: string; sourceUrl: string \}/);
  assert.match(s, /if \(!normalized \|\| !fp\) return \{ ok: false, code: 'source' \};/);
  assert.doesNotMatch(
    s,
    /code: 'no_job'/,
    'a matching job is never required (prod has no adapter)',
  );
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

test('LOW · an admin can lift a block; the notice and its hidden jobs stay as they were', () => {
  const s = server();
  assert.match(
    s,
    /\.from\('blocked_content'\)\s*\.update\(\{ lifted_at: new Date\(\)\.toISOString\(\) \}\)\s*\.eq\('fingerprint', fingerprint\)\s*\.is\('lifted_at', null\)/,
  );
  const api = read('src/app/api/admin/legal/route.ts');
  assert.match(api, /b\.kind === 'block' && b\.action === 'lift'/);
  assert.match(api, /\/\^\[0-9a-f\]\{64\}\$\/\.test\(b\.fingerprint\)/);
  assert.match(
    read('src/app/[locale]/(dashboard)/dashboard/(admin)/legal/page.tsx'),
    /<LiftBlockButton fingerprint=/,
  );
});

import { removalDoneText, removalPlan } from '@/lib/legal/removal-plan';

test('regression · with no Clips adapter (production) a removal still blocks and notifies', () => {
  const blind = removalPlan(null, 'fp1');
  assert.deepEqual(blind, { hideJobIds: [], hubListsJobs: false, engineMustRemove: true });
  const text = removalDoneText(blind);
  assert.match(text, /Bloqueamos ese video/);
  assert.match(text, /en la herramienta de Clips también se retiran/);
  assert.doesNotMatch(text, /Ocultamos/, 'never claims the hub hid something it can’t see');
  const seen = removalPlan(
    [
      { id: 'j1', fingerprint: 'fp1' },
      { id: 'j2', fingerprint: 'fp2' },
      { id: 'j3', fingerprint: 'fp1' },
    ],
    'fp1',
  );
  assert.deepEqual(seen, { hideJobIds: ['j1', 'j3'], hubListsJobs: true, engineMustRemove: false });
  assert.match(removalDoneText(seen), /Ocultamos los 2 trabajos/);
  assert.deepEqual(removalPlan([{ id: 'j9', fingerprint: 'other' }], 'fp1').engineMustRemove, true);
  // lookup reports null jobs when there is no adapter, instead of [] (which read as "no match").
  assert.match(
    server(),
    // Through the BFF (timeout, signal, breaker); no adapter or a failed call → null.
    /const listed = adapter\s*\?\s*await runTool\('chalybclip'[\s\S]*?: null;\s*const jobs = listed && listed\.ok \? listed\.data : null;/,
  );
});

test('LOW · storage failures never email "hidden"; an over-long link is its own error', () => {
  const s = server();
  assert.match(
    s,
    /if \(error\) \{\s*\/\/ Never tell the uploader something is hidden when it isn't\.[\s\S]{0,120}return \{ ok: false, code: 'db' \};/,
  );
  assert.match(s, /if \(blockErr\) \{[\s\S]{0,120}return \{ ok: false, code: 'db' \};/);
  assert.match(
    s,
    /if \(input\.sourceUrl\.trim\(\)\.length > 2000\) return \{ ok: false, code: 'tooLong' \};/,
  );
});

test('MED (#53) · a partial failure can’t leave a notice "removed" without its block: effects first, then status, then notified', () => {
  const s = server();
  const body = s.slice(
    s.indexOf('export async function removeTakedown('),
    s.indexOf("/** Admin: the uploader's counter-notice"),
  );
  const iHide = body.indexOf(".from('content_removals')");
  const iBlock = body.indexOf(".from('blocked_content')");
  const iStatus = body.indexOf("status: 'removed'");
  const iNotified = body.indexOf('user_notified_at');
  assert.ok(
    iHide > 0 && iHide < iStatus && iBlock < iStatus,
    'hides and block before the status change',
  );
  assert.ok(
    iNotified > body.indexOf('const mailed = await sendEmail('),
    'notified only after the email',
  );
  assert.match(
    body,
    /if \(mailed\.ok\)\s*await db\s*\.from\('takedown_notices'\)\s*\.update\(\{ user_notified_at:/,
  );
  assert.match(
    body,
    /if \(!pendingNotice \|\| pendingNotice\.status !== 'received'\) return \{ ok: false, code: 'state' \};/,
  );
});

test('nit (#53) · a lifted block is audited against the uploader, not the admin', () => {
  assert.match(
    server(),
    /targetUserId: \(notice\?\.target_user_id as string \| null\) \?\? actorId/,
  );
});
