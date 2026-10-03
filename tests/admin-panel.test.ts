// P5 owner panel: KPI aggregations on fixtures, zero bases, revenue from
// payments only, people rules, attention, activity merge, the toggle
// override, the six-item nav and the "Ejemplo" rule.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  commandKpis,
  delta,
  MIN_BASE,
  moneyPage,
  monthWindow,
  movementState,
  netRevenue,
  type PaymentFact,
  type SubscriptionFact,
} from '@/lib/admin/kpis';
import { filterPeople, personActions, personStatus, type PersonRow } from '@/lib/admin/people';
import { attentionItems, toolHealth, SLOW_FAILURES_24H } from '@/lib/admin/attention';
import { mergeActivity, type ActivityEvent } from '@/lib/admin/activity';
import { resolveBillingToggle } from '@/config/pricing';
import { ADMIN_NAV, activeAdminNav } from '@/components/dashboard/admin/admin-routes';

const NOW = new Date('2026-10-15T18:00:00Z'); // 12:00 in Mexico City
const DAY = 86_400_000;
const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

let n = 0;
const pay = (over: Partial<PaymentFact>): PaymentFact => ({
  id: `p${n++}`,
  user_id: 'u1',
  amount_cents: 86884,
  currency: 'MXN',
  status: 'approved',
  refunded_cents: 0,
  kind: 'subscription',
  plan_key: 'pro_month',
  mp_preapproval_id: null,
  created_at: at(-DAY),
  ...over,
});
const sub = (over: Partial<SubscriptionFact>): SubscriptionFact => ({
  user_id: 'u1',
  status: 'authorized',
  plan_key: 'pro_month',
  tier: 'PRO',
  mp_preapproval_id: null,
  trial_ends_at: null,
  started_at: at(-40 * DAY),
  created_at: at(-40 * DAY),
  cancel_at_period_end: false,
  cancelled_at: null,
  ...over,
});

test('month windows are cut in Mexico City time', () => {
  const w = monthWindow(new Date('2026-10-01T05:30:00Z')); // still 30 Sep 23:30 in CDMX
  assert.equal(w.start.toISOString(), '2026-09-01T06:00:00.000Z');
  assert.equal(w.end.toISOString(), '2026-10-01T06:00:00.000Z');
  assert.equal(monthWindow(NOW, -1).start.toISOString(), '2026-09-01T06:00:00.000Z');
});

test('revenue = settled charges − refunds; pending, failed and other months never count', () => {
  const rows = [
    pay({ amount_cents: 100_000 }),
    pay({ amount_cents: 50_000, refunded_cents: 20_000 }),
    pay({ amount_cents: 99_999, status: 'rejected' }),
    pay({ amount_cents: 99_999, status: 'pending' }),
    pay({ amount_cents: 99_999, status: 'refunded' }),
    pay({ amount_cents: 99_999, created_at: at(-40 * DAY) }),
  ];
  const r = netRevenue(rows, monthWindow(NOW));
  assert.deepEqual(
    { net: r.netCents, gross: r.grossCents, refunded: r.refundedCents, count: r.count },
    { net: 130_000, gross: 150_000, refunded: 20_000, count: 2 },
  );
});

test('no delta on a zero or near-zero base (B18, B23)', () => {
  assert.equal(delta(500_000, 0, MIN_BASE.revenueCents), null);
  assert.equal(delta(500_000, MIN_BASE.revenueCents - 1, MIN_BASE.revenueCents), null);
  assert.equal(delta(300_000, 200_000, MIN_BASE.revenueCents), 0.5);
  const k = commandKpis([pay({ amount_cents: 900_000 })], [], NOW);
  assert.equal(k.revenueDelta, null, 'no previous month at all → "sin datos suficientes"');
  assert.equal(k.conversionOf10, null);
});

test('Centro de mando KPIs on fixtures', () => {
  const subs = [
    sub({ user_id: 'a', mp_preapproval_id: 'pa' }), // paying, first charge this month
    sub({ user_id: 'b', mp_preapproval_id: 'pb' }), // paying since before
    sub({ user_id: 'c', trial_ends_at: at(3 * DAY) }), // trial ending this week
    sub({ user_id: 'd', trial_ends_at: at(20 * DAY) }), // trial
    sub({ user_id: 'e', status: 'cancelled', cancel_at_period_end: true }),
    // finished trials: 6 of them, 3 paid → "de cada 10, 5 se quedan"
    ...[0, 1, 2, 3, 4, 5].map((i) =>
      sub({
        user_id: `t${i}`,
        mp_preapproval_id: `pt${i}`,
        status: i < 3 ? 'authorized' : 'cancelled',
        trial_ends_at: at(-(i + 1) * DAY),
      }),
    ),
  ];
  const pays = [
    pay({ mp_preapproval_id: 'pa', created_at: at(-2 * DAY) }),
    pay({ mp_preapproval_id: 'pb', created_at: at(-50 * DAY) }),
    pay({ mp_preapproval_id: 'pb', created_at: at(-3 * DAY) }),
    ...[0, 1, 2].map((i) => pay({ mp_preapproval_id: `pt${i}`, created_at: at(-i * DAY) })),
  ];
  const k = commandKpis(pays, subs, NOW);
  assert.equal(k.subscribers, 2 + 3, 'a, b and the three trials that paid');
  assert.equal(k.subscribersNew, 1 + 3, 'first charge this month');
  assert.equal(k.trials, 2);
  assert.equal(k.trialsEndingThisWeek, 1);
  assert.equal(k.trialsFinished, 6);
  assert.equal(k.trialsPaid, 3);
  assert.equal(k.conversionOf10, 5);
  assert.equal(k.revenue.count, 5);
});

test('Dinero: failed, refunds, six months, funnel, movement states', () => {
  const pays = [
    pay({ status: 'rejected' }),
    pay({ refunded_cents: 1000 }),
    pay({ status: 'charged_back' }),
    pay({ created_at: at(-70 * DAY) }),
  ];
  const subs = [
    sub({ user_id: 'x', started_at: at(-5 * DAY), trial_ends_at: at(25 * DAY) }),
    sub({
      user_id: 'y',
      started_at: at(-6 * DAY),
      trial_ends_at: at(24 * DAY),
      status: 'cancelled',
      cancel_at_period_end: true,
    }),
  ];
  const m = moneyPage(pays, subs, NOW);
  assert.equal(m.failedCharges, 1);
  assert.equal(m.refunds, 2);
  assert.equal(m.byMonth.length, 6);
  assert.ok(
    m.byMonth.every((b, i, a) => i === 0 || b.start > a[i - 1]!.start),
    'oldest first',
  );
  assert.deepEqual(m.funnel, { started: 2, stillTrial: 1, paid: 0, cancelled: 1 });
  assert.equal(movementState({ status: 'approved', refunded_cents: 0 }), 'charged');
  assert.equal(movementState({ status: 'approved', refunded_cents: 5 }), 'refunded');
  assert.equal(movementState({ status: 'rejected', refunded_cents: 0 }), 'failed');
  assert.equal(movementState({ status: 'in_process', refunded_cents: 0 }), 'pending');
});

test('the panel never reads plans to compute revenue', () => {
  const src = readFileSync(
    fileURLToPath(new URL('../src/lib/admin/kpis.ts', import.meta.url)),
    'utf8',
  );
  assert.doesNotMatch(
    src,
    /planPrice|PRICING|amount_cents\s*\*\s*/,
    'revenue only from payments rows',
  );
});

test('people: status chips, search, and only actions that make sense', () => {
  const t = NOW.getTime();
  assert.equal(personStatus(null, t), 'free');
  assert.equal(personStatus(sub({}), t), 'active');
  assert.equal(personStatus(sub({ trial_ends_at: at(5 * DAY) }), t), 'trial');
  assert.equal(
    personStatus({ ...sub({ status: 'paused' }), grace_ends_at: at(3 * DAY) }, t),
    'past_due',
  );
  assert.equal(
    personStatus(
      { ...sub({ status: 'cancelled', cancel_at_period_end: true }), access_until: at(5 * DAY) },
      t,
    ),
    'ending',
  );
  assert.equal(
    personStatus(
      { ...sub({ status: 'cancelled', cancel_at_period_end: true }), access_until: at(-5 * DAY) },
      t,
    ),
    'cancelled',
  );

  const row = (
    id: string,
    name: string,
    s: PersonRow['status'],
    sb: PersonRow['sub'],
  ): PersonRow => ({
    id,
    name,
    email: `${id}@x.mx`,
    plan: 'Pro',
    status: s,
    since: at(0),
    sub: sb,
  });
  const rows = [
    row('ana', 'Ana', 'trial', null),
    row('beto', 'Beto', 'past_due', null),
    row('caro', 'Caro', 'ending', null),
  ];
  assert.deepEqual(
    filterPeople(rows, 'cancelled', '').map((r) => r.id),
    ['caro'],
  );
  assert.deepEqual(
    filterPeople(rows, 'all', 'BETO@').map((r) => r.id),
    ['beto'],
  );

  const active = personActions(row('a', 'A', 'active', sub({})), 86884);
  assert.equal(active.giftMonth, false, 'a free month would not stop an automatic charge');
  assert.equal(active.cancel, true);
  assert.equal(active.refundLast, true);
  const free = personActions(row('f', 'F', 'free', null), null);
  assert.deepEqual(free, {
    giftMonth: true,
    changePlan: true,
    resendAccess: true,
    refundLast: false,
    cancel: false,
  });
});

test('attention: only pending items, each with a target', () => {
  const items = attentionItems({
    failedCharges: 2,
    refundRequests: 0,
    slowTools: 1,
    newIdeas: 0,
    bouncedNotices: 1,
    chargesWithoutNotice: 0,
  });
  assert.deepEqual(
    items.map((i) => [i.key, i.n]),
    [
      ['failedCharges', 2],
      ['slowTools', 1],
      ['bouncedNotices', 1],
    ],
  );
  assert.ok(items.every((i) => i.href.startsWith('/dashboard/')));
  assert.equal(toolHealth({ engineState: null, failures24h: 0 }), 'ok', 'no report is not "down"');
  assert.equal(toolHealth({ engineState: 'HEALTHY', failures24h: SLOW_FAILURES_24H }), 'slow');
  assert.equal(toolHealth({ engineState: 'DELAYED', failures24h: 0 }), 'slow');
  assert.equal(toolHealth({ engineState: 'ERROR', failures24h: 0 }), 'down');
});

test('activity: merged, newest first, deduped, filtered by type and tool', () => {
  const e = (
    id: string,
    at: string,
    type: ActivityEvent['type'],
    tool: string | null = null,
  ): ActivityEvent => ({ id, at, type, tool, title: id, detail: null, who: null });
  const merged = mergeActivity([
    [e('a', '2026-10-01T10:00:00Z', 'charge'), e('b', '2026-10-03T10:00:00Z', 'admin')],
    [
      e('c', '2026-10-02T10:00:00Z', 'tool', 'chalybclip'),
      e('a', '2026-10-01T10:00:00Z', 'charge'),
    ],
  ]);
  assert.deepEqual(
    merged.map((x) => x.id),
    ['b', 'c', 'a'],
  );
  assert.deepEqual(
    mergeActivity([merged], { type: 'tool' }).map((x) => x.id),
    ['c'],
  );
  assert.deepEqual(
    mergeActivity([merged], { tool: 'chalybclip' }).map((x) => x.id),
    ['c'],
  );
});

test('the Mensual/Anual override is what pricing reads', () => {
  assert.equal(resolveBillingToggle(false, true), false);
  assert.equal(resolveBillingToggle(true, false), true);
  assert.equal(resolveBillingToggle(undefined, true), true);
  assert.equal(resolveBillingToggle('false', true), true, 'only a real boolean overrides');
});

test('six nav items, exactly', () => {
  assert.deepEqual(
    ADMIN_NAV.map((x) => x.key),
    ['command', 'people', 'money', 'tools', 'activity', 'settings'],
  );
  assert.equal(activeAdminNav('/en/dashboard/dinero?estado=failed'), 'money');
  assert.equal(activeAdminNav('/dashboard/team'), null);
});

test('no sample number on the owner panel without "Ejemplo" (P5-7)', () => {
  const dir = fileURLToPath(
    new URL('../src/app/[locale]/(dashboard)/dashboard/(admin)/', import.meta.url),
  );
  const files: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.tsx')) files.push(p);
    }
  };
  walk(dir);
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    assert.doesNotMatch(src, /value=["'{]\s*["'`][^"'`]*\d/, `${f}: a KPI with a literal number`);
    if (/MONTHLY_OPERATING_COSTS/.test(src))
      assert.match(src, /<ExampleTag>/, `${f}: configured costs need "Ejemplo"`);
  }
});
