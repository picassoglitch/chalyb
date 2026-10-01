// Static guards over customer code (P0-3, BUILD-SPEC §4.3).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** Customer-facing code: the subscriber app and its components. */
const CUSTOMER_DIRS = [
  'src/app/[locale]/(dashboard)/app',
  'src/components/workspace',
  'src/components/app',
  'src/components/ui',
];

function files(dir: string): string[] {
  const abs = join(ROOT, dir);
  const out: string[] = [];
  for (const name of readdirSync(abs)) {
    const path = join(abs, name);
    if (statSync(path).isDirectory()) out.push(...files(join(dir, name)));
    else if (/\.tsx?$/.test(name)) out.push(join(dir, name));
  }
  return out;
}

const customerFiles = CUSTOMER_DIRS.flatMap(files);

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

test('access is decided only by getEntitlements', () => {
  // The ladder lives in lib/billing/tiers.ts and is applied in
  // lib/billing/entitlement-core.ts. Customer code reads the result.
  const PLAN_CHECKS =
    /\b(engineIsLiveForUser|engineCanRunLive|botCanRunLive|isChalybclipTrialActive|isChalybclipGraceActive|TIER_ORDER|isPro|requiresPro)\b|plan\s*===\s*'(PRO|VIP)'/;
  const hits = customerFiles.filter((f) =>
    PLAN_CHECKS.test(stripComments(readFileSync(join(ROOT, f), 'utf8'))),
  );
  assert.deepEqual(hits, []);
});

test('no button or link without an action', () => {
  const DEAD =
    /onClick=\{\s*\(\)\s*=>\s*\{\s*\}\s*\}|onClick=\{\s*undefined\s*\}|href=(\{\s*)?["'`]#?["'`]\s*\}?/;
  const hits = customerFiles.filter((f) => DEAD.test(readFileSync(join(ROOT, f), 'utf8')));
  assert.deepEqual(hits, []);
});

test('customer code never sends raw error text to a toast or error state', () => {
  const RAW = /(showToast|setError|toast)\([^)]*\b(err|error|e)\.message/;
  const hits = customerFiles.filter((f) => RAW.test(readFileSync(join(ROOT, f), 'utf8')));
  assert.deepEqual(hits, []);
});
