// WS-13 · .env.local.example lists every variable the app reads, so a new
// flag can't ship undocumented (all-pending prompt §8).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
/** Set by the platform or the runtime, or deprecated aliases. */
const PLATFORM = new Set([
  'NODE_ENV',
  'VERCEL_ENV',
  'VERCEL_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'NEXT_PUBLIC_SITE_URL',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

test('every env var read under src/ is in .env.local.example', () => {
  const example = readFileSync(join(ROOT, '.env.local.example'), 'utf8');
  const documented = new Set([...example.matchAll(/^#?\s*([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]!));
  const read = new Set<string>();
  const re =
    /readBool\('([A-Z0-9_]+)'|readInt\('([A-Z0-9_]+)'|process\.env\.([A-Z][A-Z0-9_]+)|process\.env\['([A-Z][A-Z0-9_]+)'\]/g;
  for (const f of walk(join(ROOT, 'src'))) {
    for (const m of readFileSync(f, 'utf8').matchAll(re)) read.add((m[1] ?? m[2] ?? m[3] ?? m[4])!);
  }
  const missing = [...read].filter((v) => !documented.has(v) && !PLATFORM.has(v)).sort();
  assert.deepEqual(missing, []);
  // Template names (process.env[`TOOL_HUB_MODE_${slug}`]): at least one
  // documented variable with that prefix.
  const prefixes = new Set<string>();
  for (const f of walk(join(ROOT, 'src'))) {
    for (const m of readFileSync(f, 'utf8').matchAll(/process\.env\[`([A-Z][A-Z0-9_]*)\$\{/g))
      prefixes.add(m[1]!);
  }
  const undocumented = [...prefixes].filter((p) => ![...documented].some((d) => d.startsWith(p)));
  assert.deepEqual(undocumented, []);
  assert.ok(prefixes.has('TOOL_HUB_MODE_'), 'template reads are seen');
});
