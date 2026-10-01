// Runs `pnpm check:copy` as part of `pnpm test` (rebuild prompt §6.1).

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('no new hardcoded customer copy', () => {
  const script = fileURLToPath(new URL('../scripts/check-hardcoded-copy.mjs', import.meta.url));
  const run = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
});
