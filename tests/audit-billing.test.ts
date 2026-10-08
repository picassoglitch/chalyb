// Overnight audit 2026-10-08 (hub-core billing): source-level guards for the
// billing / Mercado Pago bug fixes. Each test pins one fix.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const src = (p: string) => readFileSync(join(ROOT, p), 'utf8');

test('legacy monthly checkout is retired: page redirects, actions refuse', () => {
  const page = src('src/app/[locale]/(dashboard)/app/subscription/checkout/page.tsx');
  assert.match(page, /redirect\(\{ href: '\/app\/billing', locale \}\)/);
  assert.doesNotMatch(page, /<SubscriptionCheckout/);
  const actions = src('src/lib/payments/subscription-actions.ts');
  assert.match(actions, /const LEGACY_CHECKOUT_RETIRED = true;/);
  assert.match(actions, /if \(LEGACY_CHECKOUT_RETIRED \|\| !paidCheckoutEnabled\(\)\)/);
});
