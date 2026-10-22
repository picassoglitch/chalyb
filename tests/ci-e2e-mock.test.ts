// scripts/e2e-mock.sh puts every tool in mock mode; a tool missing there would hit its real engine in CI.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the CI e2e script mocks exactly the tools in TOOL_SLUGS', () => {
  const registry = readFileSync('src/lib/tools/registry.ts', 'utf8');
  const block = registry.slice(registry.indexOf('export const TOOL_SLUGS'));
  const slugs = [...block.slice(0, block.indexOf('} as const')).matchAll(/:\s*'([a-z]+)'/g)].map(
    (m) => m[1],
  );
  const script = readFileSync('scripts/e2e-mock.sh', 'utf8');
  const mocked = script.match(/^for tool in ([a-z ]+); do/m)?.[1]?.split(' ') ?? [];
  assert.ok(slugs.length >= 7, 'TOOL_SLUGS parsed');
  assert.deepEqual([...mocked].sort(), [...slugs].sort());
});
