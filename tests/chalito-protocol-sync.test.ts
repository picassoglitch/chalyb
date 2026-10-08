import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PlansConfig, resolveInclusions, type Inclusions } from '../src/lib/chalito/pkg/protocol/plans';
import { HubUsageKind } from '../src/lib/chalito/pkg/protocol/billing';
import { HUB_PLAN_LIMITS } from '../src/lib/chalito/pkg/ui/settings/plan-limits';

// The ladder numbers from picassoglitch/chalito packages/config/plans.yaml (main) that the hub tiers map to.
const inc = (devices: number, rooms: number, membersPerRoom: number, whatsapp: number): Inclusions => ({
  devices,
  concurrentSessions: 1,
  voiceMinutes: 0,
  calls: 0,
  whatsapp,
  sms: 0,
  rooms,
  membersPerRoom,
  mesaBrains: 1,
  maxProfile: 'low',
  managedAllowance: { billableTokens: 1 },
});
const hubTiers = {
  free: { access: 'lite', limits: { devices: 1, whatsapp: 0 } },
  pro: { access: 'standard' },
  vip: { access: 'plus' },
} as const;
const cfg = {
  hubTiers,
  tiers: { lite: { inclusions: inc(2, 1, 4, 100) }, standard: { inclusions: inc(5, 5, 8, 300) }, plus: { inclusions: inc(10, 10, 20, 1000) } },
} as unknown as PlansConfig;

test('protocol sync: hubTiers accept per-tier limits (plans.yaml on chalito main has them)', () => {
  const parsed = PlansConfig.shape.hubTiers.parse(hubTiers);
  assert.deepEqual(parsed.free.limits, { devices: 1, whatsapp: 0 });
});

test('protocol sync: resolveInclusions applies the Gratis caps on top of its ladder tier', () => {
  const free = resolveInclusions(cfg, 'free');
  assert.equal(free?.devices, 1);
  assert.equal(free?.whatsapp, 0);
  assert.equal(free?.rooms, 1);
  assert.equal(resolveInclusions(cfg, 'pro')?.devices, 5);
  assert.equal(resolveInclusions(cfg, 'nope'), null);
  assert.equal(resolveInclusions(cfg, null), null);
});

test('protocol sync: the Ajustes plan line matches what resolveInclusions grants', () => {
  for (const [plan, shown] of Object.entries(HUB_PLAN_LIMITS)) {
    const r = resolveInclusions(cfg, plan);
    assert.deepEqual({ devices: r?.devices, rooms: r?.rooms, members: r?.membersPerRoom }, shown, plan);
  }
});

test('protocol sync: hub usage kinds include image.generations', () => {
  assert.ok(HubUsageKind.options.includes('image.generations'));
});

test('protocol sync: every connection mode has a label in both languages', () => {
  for (const lang of ['es', 'en']) {
    const m = JSON.parse(readFileSync(`src/lib/chalito/messages/${lang}.json`, 'utf8'));
    for (const mode of ['byo_api_key', 'byo_subscription_local', 'byo_mcp_connector', 'managed', 'api_key', 'signin'])
      assert.ok(m.settings.connections.mode[mode], `${lang} ${mode}`);
  }
});
