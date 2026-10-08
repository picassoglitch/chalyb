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

test('syncSubscription asks for a retry when the row is not written yet', () => {
  const s = src('src/lib/payments/subscription-sync.ts');
  assert.match(s, /if \(beforeErr\) \{[\s\S]{0,140}retry: true/);
  assert.match(s, /if \(!before && status === 'authorized'\) \{[\s\S]{0,200}retry: true/);
  // The retry check runs before the price gate.
  assert.ok(s.indexOf("!before && status === 'authorized'") < s.indexOf('gatePreapproval({'));
  const start = src('src/lib/billing/start-subscription.ts');
  assert.match(start, /const \{ error: rowErr \} = await admin\.from\('subscriptions'\)\.upsert/);
  assert.match(start, /if \(rowErr\) \{[\s\S]{0,300}cancelPreapproval\(preapprovalId\)/);
});

test('recordAuthorizedPayment keeps a known ledger status over an unmapped one', () => {
  const s = src('src/lib/payments/subscription-sync.ts');
  assert.match(s, /status: ledgerStatus\(paymentStatus, previousLedgerStatus\)/);
  assert.doesNotMatch(s, /\n\s+status: paymentStatus,\n/);
  // A failed read is not "no row": it retries instead of writing blind.
  assert.match(s, /const \{ data: existing, error: existingErr \}/);
  assert.match(s, /if \(existingErr\) \{[\s\S]{0,160}retry: true/);
  assert.ok(s.indexOf('if (existingErr)') < s.indexOf('ledgerStatus(paymentStatus, previousLedgerStatus)'));
});

test('an approved authorized_payment never rolls last_charge_at back', () => {
  const s = src('src/lib/payments/subscription-sync.ts');
  assert.match(s, /const olderThanStored = !!storedAt && Date\.parse\(chargeAt\) < Date\.parse\(storedAt\);/);
  assert.match(s, /\.\.\.\(olderThanStored \? \{\} : \{ last_charge_at: chargeAt \}\)/);
});

test('cancel: missing evidence after MP cancelled still reports the cancellation', () => {
  const s = src('src/lib/billing/billing-actions.ts');
  assert.match(
    s,
    /let consentId: string \| null = null;\s*try \{\s*const consent = await recordConsent\(\{[\s\S]{0,200}'cancellation_requested'/,
  );
  assert.match(s, /consent_id: consentId,/);
});

test('a failed proration refund reaches the admin list', () => {
  const s = src('src/lib/billing/billing-actions.ts');
  assert.match(
    s,
    /proration refund failed — refund by hand[\s\S]{0,200}await notify\(\{\s*severity: 'critical'/,
  );
});

test('webhook: no MP access token asks MP to retry (503), never drops with 200', () => {
  const s = src('src/app/api/mp/webhook/route.ts');
  assert.match(
    s,
    /if \(!isMercadoPagoConfigured\(\)\) \{[\s\S]{0,500}\{ error: 'mp not configured' \}, \{ status: 503 \}/,
  );
});

test('webhook: a handled topic without an id is acknowledged (200), not retried', () => {
  const s = src('src/app/api/mp/webhook/route.ts');
  assert.match(s, /\{ ignored: 'missing id' \}, \{ status: 200 \}/);
});

test('billing cron reports a failed subscriptions query instead of a quiet run', () => {
  const s = src('src/app/api/cron/billing/route.ts');
  assert.match(s, /const \{ data: rows, error: rowsErr \} = await admin/);
  assert.match(s, /if \(rowsErr\) return NextResponse\.json\(\{ ok: false, \.\.\.stats \}, \{ status: 500 \}\);/);
});

test('settle answers 404 for an unregistered engine, like admit', () => {
  const s = src('src/app/api/engines/[slug]/usage/settle/route.ts');
  assert.match(s, /result\.error\?\.startsWith\('engine not registered'\)\) \{\s*return NextResponse\.json\(\{ error: result\.error \}, \{ status: 404 \}\);/);
});
