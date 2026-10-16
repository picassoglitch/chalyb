import test from 'node:test';
import assert from 'node:assert/strict';
import { engineTierFor, engineTierOf } from '@/lib/engines/engine-tier';

// Engines are told the effective plan (profile or subscription grant), as free | pro | vip.

test('effective plan maps to what engines accept; partner presents as pro', () => {
  assert.equal(engineTierFor('FREE'), 'FREE');
  assert.equal(engineTierFor('PRO'), 'PRO');
  assert.equal(engineTierFor('VIP'), 'VIP');
  assert.equal(engineTierFor('PARTNER'), 'PRO');
});

test('admins present as VIP whatever the profile says', () => {
  assert.equal(engineTierOf({ role: 'ADMIN', storedTier: 'FREE' }), 'VIP');
});

test('payment grace: an active subscription grant counts while the profile says FREE', () => {
  assert.equal(engineTierOf({ role: 'VIEWER', storedTier: 'FREE', grantsTier: 'PRO' }), 'PRO');
  assert.equal(engineTierOf({ role: 'VIEWER', storedTier: 'PRO', grantsTier: 'VIP' }), 'VIP');
});

test('the higher of profile and grant wins; no grant keeps the profile tier', () => {
  assert.equal(engineTierOf({ role: 'VIEWER', storedTier: 'VIP', grantsTier: 'PRO' }), 'VIP');
  assert.equal(engineTierOf({ role: 'VIEWER', storedTier: 'PRO', grantsTier: null }), 'PRO');
  assert.equal(engineTierOf({ role: 'VIEWER', storedTier: 'PARTNER' }), 'PRO');
  assert.equal(engineTierOf({ role: 'VIEWER', storedTier: 'FREE' }), 'FREE');
});

test('a chargeback suspension turns paid features off (admins stay VIP)', () => {
  assert.equal(engineTierOf({ role: 'VIEWER', storedTier: 'PRO', grantsTier: 'PRO', paidSuspended: true }), 'FREE');
  assert.equal(engineTierOf({ role: 'ADMIN', storedTier: 'FREE', paidSuspended: true }), 'VIP');
});

// Wiring: each caller that tells an engine the tier, for a lapsed and a grace user.
import { readFileSync } from 'node:fs';
import { computeEntitlements } from '@/lib/billing/entitlement-core';
import { tierAfterExpiry } from '@/lib/billing/subscription-period';
import { engineTierFromProfile } from '@/lib/engines/engine-tier';

const NOW = new Date('2026-10-16T12:00:00Z');
const PAST = '2026-10-01T00:00:00Z';
const lapsed = { role: 'VIEWER', tier: 'PRO', tier_ends_at: PAST };
const grace = { role: 'VIEWER', tier: 'PRO', tier_ends_at: PAST };
const graceBilling = { primary: { grantsTier: 'PRO' as const }, restriction: { paidSuspended: false } };

test('/tenants provisioning and api-identity: lapsed → FREE, grace → PRO', () => {
  assert.equal(engineTierFromProfile(lapsed, null, NOW), 'FREE');
  assert.equal(engineTierFromProfile(lapsed, { primary: { grantsTier: 'FREE' } }, NOW), 'FREE');
  assert.equal(engineTierFromProfile(grace, graceBilling, NOW), 'PRO');
  assert.equal(engineTierFromProfile({ role: 'ADMIN', tier: 'FREE' }, null, NOW), 'VIP');
});

const launchTier = (profile: { tier: 'PRO'; tier_ends_at: string }, grantsTier: 'FREE' | 'PRO') =>
  engineTierFor(
    computeEntitlements({
      userId: 'u',
      role: 'VIEWER',
      // getSessionUser applies the expiry before entitlements see the tier.
      storedTier: tierAfterExpiry(profile.tier, profile.tier_ends_at, NOW),
      selectedEngineId: null,
      clipsTrialStartedAt: null,
      bonusCredits: 0,
      credits: null,
      engines: [],
      nowMs: NOW.getTime(),
      flags: { freeIncludesClips: true, proIncludesAllTools: true },
      billing: { grantsTier } as never,
    }).plan,
  );

test('launch token: lapsed → FREE, grace → PRO', () => {
  assert.equal(launchTier({ tier: 'PRO', tier_ends_at: PAST }, 'FREE'), 'FREE');
  assert.equal(launchTier({ tier: 'PRO', tier_ends_at: PAST }, 'PRO'), 'PRO');
});

test('the three callers use the shared effective-tier helpers, never the raw profile tier', () => {
  const src = (f: string) => readFileSync(new URL(`../src/lib/engines/${f}`, import.meta.url), 'utf8');
  assert.match(src('launch-actions.ts'), /effectiveTier: engineTierFor\(entitlements\.plan\)/);
  assert.match(src('subscriptions.ts'), /engineTierFromProfile\(profile, billing\)/);
  assert.match(src('subscriptions.ts'), /select\('email, full_name, role, tier, tier_ends_at'\)/);
  assert.match(src('api-identity.ts'), /engineTierFromProfile\(profile, billing\)/);
  assert.match(src('api-identity.ts'), /tier_ends_at/);
  for (const f of ['launch-actions.ts', 'subscriptions.ts', 'api-identity.ts'])
    assert.doesNotMatch(src(f), /effectiveTier\(session|computeEffectiveTier\(/, f);
});
