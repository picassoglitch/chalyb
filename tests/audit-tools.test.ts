// Overnight audit 2026-10-08 (hub-core, tools): regression guards.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const src = (p: string) => readFileSync(join(ROOT, p), 'utf8');

test('every place that lists or serves a clip skips jobs removed after a copyright notice', () => {
  const guarded = [
    'src/app/[locale]/(dashboard)/app/clips/page.tsx',
    'src/app/[locale]/(dashboard)/app/clips/mis-clips/page.tsx',
    'src/app/[locale]/(dashboard)/app/clips/[clipId]/page.tsx',
    'src/lib/tools/clips-jobs.ts',
    'src/lib/tools/status-lines.ts',
  ];
  for (const p of guarded) assert.match(src(p), /withoutHiddenJobs\(/, p);
  for (const p of [
    'src/app/api/tools/chalybclip/clips/[clipId]/route.ts',
    'src/app/api/tools/chalybclip/clips/[clipId]/publish/route.ts',
  ]) {
    assert.match(src(p), /isJobHidden\(session\.user\.id, clip\.jobId\)/, p);
  }
});
