// WS-13 · leftovers: D7 (one source for what Pro includes), D8 (only the
// Clips limits the Clips app enforces), and the clips-flow e2e flake.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TIER_CAPS, liveToolSlots } from '@/lib/billing/tiers';
import { allToolsClaimAllowed, planFeatureClipLimitsEnforced } from '@/lib/config/flags';

const ROOT = new URL('../', import.meta.url).pathname;
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

test('D7 · live tool slots follow the same flag as the entitlement', () => {
  assert.equal(liveToolSlots('FREE', true), 0);
  assert.equal(liveToolSlots('PRO', true), Infinity, 'Pro with every tool has nothing to pick');
  assert.equal(liveToolSlots('PRO', false), TIER_CAPS.PRO.liveEnginesCount);
  assert.equal(liveToolSlots('VIP', false), Infinity);
  // The entitlement (entitlement-core) and the slot picker read the same flag.
  assert.match(
    read('src/lib/billing/entitlement-core.ts'),
    /input\.flags\.proIncludesAllTools && plan !== 'FREE'/,
  );
  assert.match(
    read('src/lib/auth/selected-engine-actions.ts'),
    /liveToolSlots\(session\.tier, proIncludesAllTools\(\)\)/,
  );
});

test('D7 · the current Terms’ Pro line says what the server grants', () => {
  for (const f of ['src/content/legal/terms.es.tsx', 'src/content/legal/terms.en.tsx']) {
    assert.match(read(f), /proIncludesAllTools\(\)\s*\?/, f);
  }
});

test('C4 / D7 · "todas las herramientas" copy only behind allToolsClaimAllowed', () => {
  assert.equal(allToolsClaimAllowed(), false, 'not aligned yet (owner O-9)');
  const freePlan = read('src/components/app/billing/free-plan.tsx');
  assert.match(freePlan, /allToolsClaimAllowed\(\) \? t\('add\.tools'\)/);
  assert.doesNotMatch(freePlan, /proIncludesAllTools/);
});

test('D8 · the unenforced Gratis Clips limits are off by default', () => {
  delete process.env.PLAN_FEATURE_CLIP_LIMITS_ENFORCED;
  assert.equal(planFeatureClipLimitsEnforced(), false);
  const es = JSON.parse(read('messages/es.json')).plans.feat;
  assert.doesNotMatch(es.clipsTryWatermark, /SD/);
});

test('clips-flow flake · the job page chains its refreshes, never a fixed interval', () => {
  const src = read('src/components/app/clips/auto-refresh.tsx');
  assert.doesNotMatch(src, /setInterval\(/);
  assert.match(src, /useTransition/);
  assert.match(src, /if \(pending\) return;/);
});
