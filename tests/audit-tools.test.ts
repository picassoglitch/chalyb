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

test('Tus herramientas status lines never call a tool the hub does not run', () => {
  assert.match(src('src/lib/tools/status-lines.ts'), /if \(!hubRunsTool\(slug\)\) return;/);
});

test('Clips counts as in-hub only in mock mode, matching getClipsAdapter()', async () => {
  const { hubRunsTool } = await import('@/lib/tools/registry');
  const prev = process.env.TOOL_HUB_MODE_CHALYBCLIP;
  try {
    for (const mode of ['on', 'a', 'b', 'off', '']) {
      process.env.TOOL_HUB_MODE_CHALYBCLIP = mode;
      assert.equal(hubRunsTool('chalybclip'), false, mode);
    }
    process.env.TOOL_HUB_MODE_CHALYBCLIP = 'mock';
    assert.equal(hubRunsTool('chalybclip'), process.env.VERCEL_ENV !== 'production');
  } finally {
    if (prev === undefined) delete process.env.TOOL_HUB_MODE_CHALYBCLIP;
    else process.env.TOOL_HUB_MODE_CHALYBCLIP = prev;
  }
});

test('Señales follow switch shows the coins the server actually saved', () => {
  const s = src('src/components/tools/senales/follow-switch.tsx');
  assert.match(s, /setOn\(saved\.includes\(coin\)\)/);
});

test('re-provisioning only retries an existing active access row and keeps its source', () => {
  const s = src('src/lib/engines/subscriptions.ts');
  const fn = s.slice(s.indexOf('export async function retryEngineProvisioning'));
  assert.match(fn, /existing\.status !== 'active'/);
  assert.match(fn, /provisionEngineAccess\(userId, engineId, existing\.source\)/);
  assert.doesNotMatch(src('src/lib/engines/reprovision-actions.ts'), /dev server/);
});

test('autopublish consent only records an account the person connected', () => {
  const s = src('src/app/api/tools/consent/route.ts');
  assert.match(s, /connected\.some\(\(a\) => a\.handle === requested\)/);
});

test('stream-key password limit fails closed when the attempt count cannot be read', async () => {
  const s = src('src/app/api/tools/chalybobs/stream-key/route.ts');
  assert.match(s, /if \(error\) \{[\s\S]*?return Number\.POSITIVE_INFINITY;/);
  const { revealAttemptAllowed } = await import('@/lib/tools/envivo-core');
  assert.equal(revealAttemptAllowed(Number.POSITIVE_INFINITY), false);
});
