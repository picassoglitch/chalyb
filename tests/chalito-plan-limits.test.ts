import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HUB_PLAN_LIMITS, hubPlanOf } from '../src/lib/chalito/pkg/ui/settings/plan-limits';

test('plan limits: the owner-decided caps per Chalyb tier (plans.yaml mirror)', () => {
  assert.deepEqual(HUB_PLAN_LIMITS, {
    free: { devices: 1, rooms: 1, members: 4 },
    pro: { devices: 5, rooms: 5, members: 8 },
    vip: { devices: 10, rooms: 10, members: 20 },
  });
});

test('plan limits: hubPlanOf names only the hub tiers, case-insensitively', () => {
  assert.equal(hubPlanOf('free'), 'free');
  assert.equal(hubPlanOf('VIP'), 'vip');
  for (const t of ['admin', 'lite', '', null, undefined, 'constructor']) assert.equal(hubPlanOf(t), null);
});

test('plan limits: every tier has a name and a limits line in both languages', () => {
  for (const lang of ['es', 'en']) {
    const m = JSON.parse(readFileSync(`src/lib/chalito/messages/${lang}.json`, 'utf8'));
    for (const plan of Object.keys(HUB_PLAN_LIMITS)) assert.ok(m.settings.planCredits.names[plan], `${lang} ${plan}`);
    assert.match(m.settings.planCredits.limits, /\{devices, plural/);
    assert.equal(m.credits.plan.limits, m.settings.planCredits.limits);
  }
});
