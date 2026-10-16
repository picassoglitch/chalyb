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
