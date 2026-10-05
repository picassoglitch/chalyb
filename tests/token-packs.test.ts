// Credit packs (Términos de los Paquetes §4, §8; migration 0061). The draws,
// holds and per-pack refunds run against Postgres in scripts/test-migrations.mjs;
// this covers the balance the app shows and admits on, and the store taglines.

import test from 'node:test';
import assert from 'node:assert/strict';
import { composeBalance } from '@/lib/usage/tokens';
import { TOKEN_PACKS, packSavingsPercent } from '@/lib/payments/pricing';
import { packPriceCents } from '@/config/pricing';

const subject = { unlimited: false, monthlyAllocation: 1000 };
const at = '2026-10-01T00:00:00.000Z';

test('plan credits first, then pack credits', () => {
  const b = composeBalance(subject, { used: 400, reserved: 0, bonus: 500, periodStart: at });
  assert.equal(b.remaining, 600 + 500);
});

test('usage above the plan is not subtracted twice (it already came off the packs)', () => {
  // 1,300 used of 1,000: the 300 extra were drawn, leaving 200 of a 500 pack.
  const b = composeBalance(subject, { used: 1300, reserved: 0, bonus: 200, periodStart: at });
  assert.equal(b.remaining, 200);
});

test('a pack is not a monthly extra: a new month starts from what is left of it', () => {
  const b = composeBalance(subject, { used: 0, reserved: 0, bonus: 200, periodStart: at });
  assert.equal(b.remaining, 1000 + 200);
});

test('held credits are shown but never spendable', () => {
  const b = composeBalance(subject, { used: 1000, reserved: 0, bonus: 0, held: 500, periodStart: at });
  assert.equal(b.remaining, 0);
  assert.equal(b.held, 500);
});

test('reservations hold against the total, never below zero', () => {
  const b = composeBalance(subject, { used: 900, reserved: 300, bonus: 100, periodStart: at });
  assert.equal(b.remaining, 0);
});

test('admins stay unlimited', () => {
  const b = composeBalance(
    { unlimited: true, monthlyAllocation: 0 },
    { used: 5, reserved: 0, bonus: 0, periodStart: at },
  );
  assert.equal(b.unlimited, true);
  assert.equal(b.remaining, Number.MAX_SAFE_INTEGER);
});

test('pack taglines state the real saving, rounded down, and only one is "Mejor relación"', () => {
  const perK = (id: (typeof TOKEN_PACKS)[number]['id'], tokens: number) =>
    packPriceCents(id) / (tokens / 1000);
  const base = perK('tokens_100k', 100_000);
  for (const p of TOKEN_PACKS) {
    const real = (1 - perK(p.id, p.tokens) / base) * 100;
    const shown = packSavingsPercent(p.id);
    assert.ok(shown <= real && real - shown < 1, `${p.id}: ${shown}% vs ${real.toFixed(2)}%`);
    if (shown > 0) assert.match(p.tagline, new RegExp(`\\b${shown}%`));
  }
  assert.equal(TOKEN_PACKS.filter((p) => /Mejor relación/.test(p.tagline)).length, 1);
  assert.match(TOKEN_PACKS.find((p) => p.id === 'tokens_2m')!.tagline, /Mejor relación/);
  assert.ok(!TOKEN_PACKS.some((p) => /~/.test(p.tagline)), 'no approximate savings claims');
});
