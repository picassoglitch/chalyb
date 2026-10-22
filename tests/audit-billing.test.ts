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
  // Whatever the status: a pending notice must not write a row without plan_key.
  assert.match(s, /if \(!before && rowMayLand\) \{[\s\S]{0,200}retry: true/);
  assert.doesNotMatch(s, /!before && status === 'authorized'/);
  // The retry check runs before the price gate and before the upsert.
  assert.ok(s.indexOf('if (!before && rowMayLand) {') < s.indexOf('gatePreapproval({'));
  assert.ok(
    s.indexOf('if (!before && rowMayLand) {') < s.indexOf(".from('subscriptions').upsert("),
  );
});

test('recordAuthorizedPayment keeps a known ledger status over an unmapped one', () => {
  const s = src('src/lib/payments/subscription-sync.ts');
  assert.match(s, /status: ledgerStatus\(paymentStatus, previousLedgerStatus\)/);
  assert.doesNotMatch(s, /\n\s+status: paymentStatus,\n/);
  // A failed read is not "no row": it retries instead of writing blind.
  assert.match(s, /const \{ data: existing, error: existingErr \}/);
  assert.match(s, /if \(existingErr\) \{[\s\S]{0,160}retry: true/);
  assert.ok(
    s.indexOf('if (existingErr)') < s.indexOf('ledgerStatus(paymentStatus, previousLedgerStatus)'),
  );
});

test('an approved authorized_payment never rolls last_charge_at back', () => {
  const s = src('src/lib/payments/subscription-sync.ts');
  assert.match(
    s,
    /const olderThanStored = !!storedAt && Date\.parse\(chargeAt\) < Date\.parse\(storedAt\);/,
  );
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
  assert.match(
    s,
    /if \(rowsErr\) return NextResponse\.json\(\{ ok: false, \.\.\.stats \}, \{ status: 500 \}\);/,
  );
});

test('settle answers 404 for an unregistered engine, like admit', () => {
  const s = src('src/app/api/engines/[slug]/usage/settle/route.ts');
  assert.match(
    s,
    /result\.error\?\.startsWith\('engine not registered'\)\) \{\s*return NextResponse\.json\(\{ error: result\.error \}, \{ status: 404 \}\);/,
  );
});

test("an earlier cycle's approved charge can't lift the current hold, grace or reminder", () => {
  const s = src('src/lib/payments/subscription-sync.ts');
  assert.match(s, /const EARLIER_CYCLE_SLACK_MS = 7 \* 86_400_000;/);
  assert.match(s, /Date\.parse\(chargeAt\) < Date\.parse\(storedAt\) - EARLIER_CYCLE_SLACK_MS/);
  // The whole state reset sits behind the guard, hold included.
  assert.match(s, /if \(!earlierCycle\) \{[\s\S]{0,400}charge_hold_until: null/);
});

test('replay guard: a failed subscriptions read retries instead of rolling the charge date back', () => {
  const s = src('src/lib/payments/subscription-sync.ts');
  assert.match(s, /const \{ data: subRow, error: subErr \} = await admin/);
  assert.match(s, /if \(subErr\) \{[\s\S]{0,120}retry: true/);
  assert.ok(s.indexOf('if (subErr)') < s.indexOf('const olderThanStored'));
});

test('a failed row write never cancels a preapproval that already charged', () => {
  const start = src('src/lib/billing/start-subscription.ts');
  const block = start.slice(
    start.indexOf('if (rowErr) {'),
    start.indexOf("if (mode === 'trial') {"),
  );
  // Cancel (and fail the checkout) only when the first charge is later.
  assert.match(
    block,
    /if \(firstChargeLater\) \{\s*await cancelUnchargedWithoutRow\(who\);\s*return \{ ok: false, code: 'MP_ERROR' \};\s*\}\s*await alertChargedWithoutRow\(who\);\s*\}\s*$/,
  );
  assert.match(start, /const rowErr = await writeRowWithRetry\(\(\) =>/);
  // The old comment promised a refund path that doesn't exist.
  assert.doesNotMatch(start, /refunded by the cancel path/);

  const legacy = src('src/lib/payments/subscription-actions.ts');
  assert.equal(legacy.match(/const rowErr = await writeRowWithRetry\(\(\) =>/g)?.length, 2);
  const card = legacy.slice(
    legacy.indexOf('export async function authorizeTierSubscription'),
    legacy.indexOf('export async function startHostedTierSubscription'),
  );
  // Card form: charged on creation, so alert and carry on to the sync.
  assert.match(card, /if \(rowErr\) \{[\s\S]{0,120}await alertChargedWithoutRow\(/);
  assert.doesNotMatch(card, /cancelUnchargedWithoutRow/);
  const hosted = legacy.slice(legacy.indexOf('export async function startHostedTierSubscription'));
  // Hosted: no card yet, so nothing charged: cancel.
  assert.match(hosted, /if \(rowErr\) \{[\s\S]{0,120}await cancelUnchargedWithoutRow\(/);
});

test('the sync waits for a checkout row only while it can still land, then builds it as before', () => {
  const s = src('src/lib/payments/subscription-sync.ts');
  assert.match(s, /export const ROW_WAIT_MS = 10 \* 60_000;/);
  assert.match(
    s,
    /const rowMayLand = !!mp\.date_created && Date\.now\(\) - Date\.parse\(mp\.date_created\) < ROW_WAIT_MS;\s*if \(!before && rowMayLand\) \{/,
  );
});

test('writeRowWithRetry: one retry, then the error', async () => {
  const { writeRowWithRetry } = await import('@/lib/payments/row-retry');
  const calls = (results: unknown[]) => {
    let n = 0;
    const write = async () => ({ error: results[n++] ?? null });
    return { write, count: () => n };
  };
  const ok = calls([null]);
  assert.equal(await writeRowWithRetry(ok.write), null);
  assert.equal(ok.count(), 1);
  const blip = calls([{ message: 'connection reset' }, null]);
  assert.equal(await writeRowWithRetry(blip.write), null);
  assert.equal(blip.count(), 2);
  const down = calls([{ message: 'a' }, { message: 'b' }, null]);
  assert.deepEqual(await writeRowWithRetry(down.write), { message: 'b' });
  assert.equal(down.count(), 2);
});
