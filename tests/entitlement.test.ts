// getEntitlements matrix (P0-3). One function decides access; these are its
// answers for every plan.

import test from 'node:test';
import assert from 'node:assert/strict';
import { computeEntitlements, type EntitlementInput } from '@/lib/billing/entitlement-core';

const NOW = Date.parse('2026-10-01T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

const ENGINES = [
  { id: 'e-clip', slug: 'chalybclip', status: 'active', tierRequired: 'PRO', ownerUserId: null },
  {
    id: 'e-crypto',
    slug: 'chalybcrypto',
    status: 'active',
    tierRequired: 'PRO',
    ownerUserId: null,
  },
  { id: 'e-obs', slug: 'chalybobs', status: 'active', tierRequired: 'PRO', ownerUserId: null },
  { id: 'e-bot', slug: 'chalybbot', status: 'coming_soon', tierRequired: 'PRO', ownerUserId: null },
  {
    id: 'e-stream',
    slug: 'chalybstream',
    status: 'active',
    tierRequired: 'PRO',
    ownerUserId: null,
  },
] as const;

function input(overrides: Partial<EntitlementInput> = {}): EntitlementInput {
  return {
    userId: 'u1',
    role: 'CLIENT',
    storedTier: 'FREE',
    selectedEngineId: null,
    clipsTrialStartedAt: null,
    bonusCredits: 0,
    credits: { remaining: 1000, unlimited: false },
    engines: ENGINES.map((e) => ({ ...e })),
    nowMs: NOW,
    flags: { freeIncludesClips: false, proIncludesAllTools: false },
    ...overrides,
  };
}

const state = (e: ReturnType<typeof computeEntitlements>, slug: string) => e.tools[slug]?.state;

test('FREE without a trial: every tool is a trial offer', () => {
  const e = computeEntitlements(input());
  assert.equal(e.plan, 'FREE');
  assert.equal(state(e, 'chalybclip'), 'trial_offer');
  assert.equal(state(e, 'chalybcrypto'), 'trial_offer');
});

test('FREE with FREE_INCLUDES_CLIPS: Clips included, others offered', () => {
  const e = computeEntitlements(
    input({ flags: { freeIncludesClips: true, proIncludesAllTools: false } }),
  );
  assert.equal(state(e, 'chalybclip'), 'included');
  assert.equal(state(e, 'chalybcrypto'), 'trial_offer');
  assert.equal(state(e, 'chalybobs'), 'trial_offer');
});

test('FREE in the legacy 7-day Clips trial: Clips only', () => {
  const e = computeEntitlements(
    input({ clipsTrialStartedAt: new Date(NOW - 2 * DAY).toISOString() }),
  );
  assert.equal(state(e, 'chalybclip'), 'included');
  assert.equal(state(e, 'chalybcrypto'), 'trial_offer');
  assert.deepEqual(e.trial, { kind: 'clips_legacy', daysLeft: 5, grace: false });
});

test('FREE after the trial with bonus credits left: grace keeps Clips', () => {
  const e = computeEntitlements(
    input({ clipsTrialStartedAt: new Date(NOW - 10 * DAY).toISOString(), bonusCredits: 500 }),
  );
  assert.equal(state(e, 'chalybclip'), 'included');
  assert.equal(e.trial?.grace, true);
});

test('PRO: the selected tool is included, the others are not (until P2)', () => {
  const e = computeEntitlements(input({ storedTier: 'PRO', selectedEngineId: 'e-crypto' }));
  assert.equal(state(e, 'chalybcrypto'), 'included');
  assert.equal(state(e, 'chalybobs'), 'trial_offer');
});

test('PRO with PRO_INCLUDES_ALL_TOOLS: every visible tool included', () => {
  const e = computeEntitlements(
    input({ storedTier: 'PRO', flags: { freeIncludesClips: false, proIncludesAllTools: true } }),
  );
  for (const slug of ['chalybclip', 'chalybcrypto', 'chalybobs'])
    assert.equal(state(e, slug), 'included');
});

test('VIP and admins: everything visible is included', () => {
  for (const e of [
    computeEntitlements(input({ storedTier: 'VIP' })),
    computeEntitlements(input({ role: 'ADMIN', storedTier: 'FREE' })),
  ]) {
    assert.equal(e.plan, 'VIP');
    for (const slug of ['chalybclip', 'chalybcrypto', 'chalybobs'])
      assert.equal(state(e, slug), 'included');
  }
});

test('unfinished and hidden tools have no entry at all', () => {
  const e = computeEntitlements(input({ storedTier: 'VIP' }));
  assert.equal(e.tools.chalybbot, undefined, 'coming_soon is not shown');
  assert.equal(e.tools.chalybstream, undefined, 'chalybstream is hidden (Q32)');
});

test('a partner-owned tool is included for its owner', () => {
  const engines = [
    {
      id: 'e-own',
      slug: 'chalybpicks',
      status: 'active',
      tierRequired: 'PRO' as const,
      ownerUserId: 'u1',
    },
  ];
  const e = computeEntitlements(input({ storedTier: 'PARTNER', engines }));
  assert.equal(state(e, 'chalybpicks'), 'included');
});
