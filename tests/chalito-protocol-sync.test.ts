import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PlansConfig, resolveInclusions, type Inclusions } from '../src/lib/chalito/pkg/protocol/plans';
import { HubUsageKind } from '../src/lib/chalito/pkg/protocol/billing';
import { AgentEvent, LiveBroadcast, isLiveOnlyEvent } from '../src/lib/chalito/pkg/protocol/agentEvent';
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
// Gratis has no Chalito on chalito main (plans.yaml, owner decision #53, 2026-10-16).
const hubTiers = {
  free: { access: 'none' },
  pro: { access: 'standard' },
  vip: { access: 'plus' },
} as const;
const cfg = {
  hubTiers,
  tiers: { lite: { inclusions: inc(2, 1, 4, 100) }, standard: { inclusions: inc(5, 5, 8, 300) }, plus: { inclusions: inc(10, 10, 20, 300) } },
} as unknown as PlansConfig;

test('protocol sync: hubTiers accept access none and per-tier limits', () => {
  const parsed = PlansConfig.shape.hubTiers.parse({ ...hubTiers, pro: { access: 'standard', limits: { devices: 3 } } });
  assert.equal(parsed.free.access, 'none');
  assert.deepEqual(parsed.pro.limits, { devices: 3 });
});

test('protocol sync: resolveInclusions applies limits and fails closed without access', () => {
  const capped = { ...cfg, hubTiers: { ...hubTiers, pro: { access: 'standard', limits: { devices: 3, whatsapp: 0 } } } } as unknown as PlansConfig;
  const pro = resolveInclusions(capped, 'pro');
  assert.equal(pro?.devices, 3);
  assert.equal(pro?.whatsapp, 0);
  assert.equal(pro?.rooms, 5);
  assert.equal(resolveInclusions(cfg, 'free'), null);
  assert.equal(resolveInclusions(cfg, 'nope'), null);
  assert.equal(resolveInclusions(cfg, null), null);
});

test('protocol sync: the Ajustes plan line matches what resolveInclusions grants', () => {
  for (const [plan, shown] of Object.entries(HUB_PLAN_LIMITS)) {
    const r = resolveInclusions(cfg, plan);
    assert.deepEqual({ devices: r?.devices ?? 0, rooms: r?.rooms ?? 0, members: r?.membersPerRoom ?? 0 }, shown, plan);
  }
});

test('protocol sync: hub usage kinds include image.generations', () => {
  assert.ok(HubUsageKind.options.includes('image.generations'));
});

test('protocol sync: streamed assistant deltas parse and stay live-only (chalito M16 A)', () => {
  const b64 = (n: number) => Buffer.alloc(n, 7).toString('base64url');
  const ct = { alg: 'xchacha20poly1305+sealedbox', nonce: b64(24), ct: b64(8), keys: { dev_phone: b64(80) } };
  const base = { v: 1, deviceId: 'dev_agent', sid: 'ses_1', eid: 'evt_1', seq: 3, t: 1_700_000_000_000 };
  const delta = AgentEvent.parse({ ...base, type: 'message.assistant.delta', mid: 'msg_1', n: 0, ct });
  assert.equal(delta.type, 'message.assistant.delta');
  assert.equal(AgentEvent.parse({ ...base, type: 'message.assistant', mid: 'msg_1', ct }).type, 'message.assistant');
  assert.equal(isLiveOnlyEvent(delta), true);
  assert.equal(isLiveOnlyEvent({ type: 'screen.state', state: 'ended' }), false);
  assert.equal(LiveBroadcast.safeParse({ table: 'live', op: 'events', deviceId: 'dev_agent', events: [delta] }).success, true);
});

test('protocol sync: every connection mode has a label in both languages', () => {
  for (const lang of ['es', 'en']) {
    const m = JSON.parse(readFileSync(`src/lib/chalito/messages/${lang}.json`, 'utf8'));
    for (const mode of ['byo_api_key', 'byo_subscription_local', 'byo_mcp_connector', 'managed', 'api_key', 'signin'])
      assert.ok(m.settings.connections.mode[mode], `${lang} ${mode}`);
  }
});
