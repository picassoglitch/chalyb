// Status honesty: a badge says "En vivo" only when the plan unlocks the engine
// AND the engine is actually runnable. Eight upcoming engines read as eight
// upcoming engines on every plan, VIP included.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveEngineViews,
  deriveNextAction,
  engineIsRunnable,
  liveCapacityLabel,
  summarizeFleet,
  type Entitlement,
  type ReadinessEngine,
} from '@/lib/billing/readiness';

function engine(over: Partial<ReadinessEngine> = {}): ReadinessEngine {
  return {
    id: over.id ?? 'e1',
    slug: over.slug ?? 'chalybcrypto',
    name: over.name ?? 'ChalyCrypto',
    status: over.status ?? 'active',
    integrationMode: over.integrationMode ?? 'external_sso_redirect',
    externalUrl: over.externalUrl === undefined ? 'https://crypto.example' : over.externalUrl,
    tierRequired: over.tierRequired ?? 'PRO',
    ownerUserId: over.ownerUserId ?? null,
  };
}

function ent(over: Partial<Entitlement> = {}): Entitlement {
  return {
    tier: over.tier ?? 'FREE',
    userId: over.userId ?? 'u1',
    selectedEngineId: over.selectedEngineId ?? null,
    trialActive: over.trialActive ?? false,
    graceActive: over.graceActive ?? false,
  };
}

const UPCOMING_FLEET: ReadinessEngine[] = [
  engine({ id: 'a', slug: 'chalybclip', name: 'ChalyClip', status: 'coming_soon' }),
  engine({ id: 'b', slug: 'chalybobs', name: 'ChalyOBS', status: 'coming_soon' }),
  engine({
    id: 'c',
    slug: 'chalybbot',
    name: 'ChalybBot',
    status: 'coming_soon',
    integrationMode: 'internal_placeholder',
    externalUrl: null,
  }),
];

test('an active row behind a placeholder integration is not runnable', () => {
  assert.equal(engineIsRunnable(engine()), true);
  assert.equal(engineIsRunnable(engine({ status: 'coming_soon' })), false);
  assert.equal(engineIsRunnable(engine({ integrationMode: 'internal_placeholder' })), false);
  assert.equal(engineIsRunnable(engine({ externalUrl: null })), false);
});

test('an empty fleet is upcoming on every plan — VIP shows 0 live, never ∞', () => {
  for (const tier of ['FREE', 'PRO', 'PARTNER', 'VIP'] as const) {
    const views = deriveEngineViews(UPCOMING_FLEET, ent({ tier }));
    assert.ok(
      views.every((v) => v.state === 'coming_soon'),
      `${tier}: all upcoming`,
    );
    assert.ok(
      views.every((v) => !v.canSelectLive),
      `${tier}: nothing to activate`,
    );
    const fleet = summarizeFleet(views);
    assert.equal(fleet.live, 0);
    assert.equal(fleet.upcoming, 3);
    assert.deepEqual(deriveNextAction(views), { kind: 'view_upcoming' });
    assert.doesNotMatch(liveCapacityLabel(tier, fleet), /∞/);
  }
});

test('the ChalyClip trial does not light up an engine that is down', () => {
  const views = deriveEngineViews(UPCOMING_FLEET, ent({ trialActive: true }));
  assert.equal(views[0]!.state, 'coming_soon');
  assert.equal(views[0]!.isTrial, false);
});

test('FREE runs a ready engine in simulation; the trial makes ChalyClip live', () => {
  const clip = engine({ id: 'clip', slug: 'chalybclip', name: 'ChalyClip' });
  const views = deriveEngineViews(
    [clip, engine({ tierRequired: 'FREE' }), engine({ id: 'gated' })],
    ent({ trialActive: true }),
  );
  assert.equal(views[0]!.state, 'trial');
  assert.equal(views[1]!.state, 'simulation');
  assert.equal(views[2]!.state, 'locked');
  assert.deepEqual(deriveNextAction(views), {
    kind: 'open_live',
    engine: { slug: 'chalybclip', name: 'ChalyClip' },
  });
});

test('PRO: the selected engine is live, other ready engines expose Activar en vivo', () => {
  const views = deriveEngineViews(
    [engine({ id: 'sel' }), engine({ id: 'other', slug: 'chalybobs', name: 'ChalyOBS' })],
    ent({ tier: 'PRO', selectedEngineId: 'sel' }),
  );
  assert.equal(views[0]!.state, 'live');
  assert.equal(views[1]!.state, 'ready');
  assert.equal(views[1]!.canSelectLive, true);
});

test('PRO with nothing selected is told to pick, not shown as live', () => {
  const views = deriveEngineViews([engine()], ent({ tier: 'PRO' }));
  assert.equal(views[0]!.state, 'ready');
  assert.equal(deriveNextAction(views).kind, 'pick_live');
});

test('a plan below the gate sees the engine locked, not upcoming', () => {
  const views = deriveEngineViews([engine({ tierRequired: 'VIP' })], ent({ tier: 'PRO' }));
  assert.equal(views[0]!.state, 'locked');
});

test('VIP over a mixed fleet: ready engines live, upcoming stay upcoming', () => {
  const views = deriveEngineViews([engine(), ...UPCOMING_FLEET], ent({ tier: 'VIP' }));
  const fleet = summarizeFleet(views);
  assert.equal(fleet.live, 1);
  assert.equal(fleet.upcoming, 3);
  assert.match(liveCapacityLabel('VIP', fleet), /1 lista/);
});
