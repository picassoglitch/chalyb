// QA 2026-11-06: Equipo called owner-assigned plans "suscripciones de pago"
// while Dinero showed zero active; plans and paid subscriptions now differ.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planSplit } from '@/lib/admin/people';
import type { SubscriptionFact } from '@/lib/admin/kpis';

const NOW = Date.parse('2026-11-06T18:00:00Z');
const DAY = 86_400_000;
const at = (ms: number) => new Date(NOW + ms).toISOString();

const sub = (user_id: string, over: Partial<SubscriptionFact> = {}): SubscriptionFact => ({
  user_id,
  status: 'authorized',
  plan_key: 'pro_monthly',
  tier: 'PRO',
  mp_preapproval_id: `pre-${user_id}`,
  trial_ends_at: null,
  started_at: at(-40 * DAY),
  created_at: at(-40 * DAY),
  cancel_at_period_end: false,
  cancelled_at: null,
  ...over,
});

test('owner-assigned plans are not counted as paying', () => {
  // The QA case: three Pro/VIP profiles, no Mercado Pago rows at all.
  const profiles = [
    { id: 'owner', tier: 'VIP' },
    { id: 'a', tier: 'PRO' },
    { id: 'b', tier: 'PRO' },
    { id: 'free', tier: 'FREE' },
  ];
  assert.deepEqual(planSplit(profiles, [], NOW), { paying: 0, trial: 0, other: 3 });
});

test('paying, trial and lapsed subscriptions split by the latest row', () => {
  const profiles = [
    { id: 'pay', tier: 'PRO' },
    { id: 'trial', tier: 'PRO' },
    { id: 'lapsed', tier: 'VIP' },
    { id: 'renewed', tier: 'PRO' },
    { id: 'assigned', tier: 'PARTNER' },
    { id: 'free-sub', tier: 'FREE' },
  ];
  const subs = [
    sub('pay'),
    sub('trial', { trial_ends_at: at(5 * DAY), created_at: at(-2 * DAY) }),
    sub('lapsed', { status: 'cancelled', cancelled_at: at(-30 * DAY) }),
    // Older cancelled row, newer authorized one: the newer wins.
    sub('renewed', { status: 'cancelled', created_at: at(-90 * DAY) }),
    sub('renewed', { created_at: at(-10 * DAY) }),
    // A FREE profile is never counted, whatever its rows say.
    sub('free-sub'),
  ];
  assert.deepEqual(planSplit(profiles, subs, NOW), { paying: 2, trial: 1, other: 2 });
});

test('row order does not change the latest subscription', () => {
  const profiles = [{ id: 'u', tier: 'PRO' }];
  const older = sub('u', { status: 'cancelled', created_at: at(-90 * DAY) });
  const newer = sub('u', { created_at: at(-1 * DAY) });
  assert.deepEqual(planSplit(profiles, [older, newer], NOW).paying, 1);
  assert.deepEqual(planSplit(profiles, [newer, older], NOW).paying, 1);
});

for (const locale of ['es', 'en']) {
  test(`${locale}: labels tell plans from paid subscriptions`, () => {
    const admin = JSON.parse(
      readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'),
    ).admin;
    assert.doesNotMatch(admin.team.plans, /suscripci|subscription/i);
    for (const k of ['paying', 'trial', 'other']) assert.match(admin.team.plansSplit, new RegExp(`\\{${k}\\}`));
    assert.match(admin.money.subscriptions, /Mercado Pago/);
    assert.match(admin.money.subsBy.active, /pagando|paying/);
  });
}

test('Equipo no longer hardcodes "Suscripciones de pago"', () => {
  const src = readFileSync(
    new URL('../src/app/[locale]/(dashboard)/dashboard/(legacy)/team/page.tsx', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(src, /Suscripciones de pago/);
  assert.match(src, /planSplit\(/);
});
