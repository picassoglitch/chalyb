// Overnight audit 2026-10-08 (hub-core billing): source-level guards for the
// billing / Mercado Pago bug fixes. Each test pins one fix.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const src = (p: string) => readFileSync(join(ROOT, p), 'utf8');

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
});

test('an approved authorized_payment never rolls last_charge_at back', () => {
  const s = src('src/lib/payments/subscription-sync.ts');
  assert.match(s, /const olderThanStored = !!storedAt && Date\.parse\(chargeAt\) < Date\.parse\(storedAt\);/);
  assert.match(s, /\.\.\.\(olderThanStored \? \{\} : \{ last_charge_at: chargeAt \}\)/);
});
