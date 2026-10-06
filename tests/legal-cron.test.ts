// /api/cron/legal ordering and limits (7a review of #49, MEDIUM 9) and the
// retention purge's clock (MEDIUM 10, tested against Postgres in
// scripts/test-migrations.mjs).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

test('MED 9 · restores and retention run before the notices, which can’t starve them', () => {
  const r = read('src/app/api/cron/legal/route.ts');
  const iRestore = r.indexOf('await runCounterNoticeRestores(now)');
  const iRetention = r.indexOf('await runRetention(now, dryRun)');
  const iNotices = r.indexOf('await runTermsChangeNotices(now, {');
  assert.ok(iRestore > 0 && iRestore < iRetention && iRetention < iNotices, 'order');
  assert.match(r, /deadline: Date\.now\(\) \+ \(maxDuration - 60\) \* 1000/);
  assert.match(r, /maxSends: NOTICE_BATCH/);
});

test('MED 9 · notices: capped batch, deadline, throttle, per-document errors, keyset anti-join', () => {
  const s = read('src/lib/legal/legal-server.ts');
  assert.match(s, /export const NOTICE_BATCH = 2000;/);
  assert.match(s, /if \(budget\.maxSends <= 0 \|\| Date\.now\(\) >= budget\.deadline\)/);
  assert.match(s, /await sleep\(NOTICE_THROTTLE_MS\)/);
  assert.match(s, /\} catch \(e\) \{\s*console\.error\(`\[legal\] \$\{doc\} notices failed`/);
  assert.match(
    s,
    /if \(report\.decision === 'paused'\) return report;/,
    'a paused run never marks complete',
  );
  assert.match(s, /db\.rpc\('legal_change_notice_recipients'/);
});

test('MED 10 · retention counts from the chargeback’s opened_at, can dry-run, audits lifted restrictions', () => {
  const sql = read('supabase/migrations/0060_legal_retention_v2.sql');
  assert.match(sql, /where opened_at < cutoff/);
  assert.doesNotMatch(sql, /coalesce\(closed_at/);
  assert.match(sql, /p_dry_run boolean default false/);
  assert.match(
    sql,
    /insert into public\.audit_events[\s\S]*'legal\.retention'[\s\S]*r\.lifted_at is null/,
  );
  assert.match(read('src/app/api/cron/legal/route.ts'), /searchParams\.get\('dry'\) === '1'/);
});

test('LOW (#53) · retention can’t abort the run; failed ARCO answer emails are resent', () => {
  const r = read('src/app/api/cron/legal/route.ts');
  assert.match(r, /await runRetention\(now, dryRun\)\.catch\(/);
  assert.match(r, /await runArcoAnswerRetries\(\)\.catch\(/);
  const s = read('src/lib/legal/legal-server.ts');
  assert.match(
    s,
    /\.eq\('kind', 'arco_answer'\)\s*\.or\(`delivery_status\.eq\.failed,and\(delivery_status\.eq\.pending,sent_at\.lt\.\$\{stale\}\)`\)/,
  );
  assert.match(s, /const r = await deliverArcoAnswer\(db, row/);
});
