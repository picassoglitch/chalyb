// QA 2026-11-07 (str_01M6SSAG74RRDYKC2N2WZJES70): the video page said 16,052
// credits (engine llm_calls/4 + base) while the balance lost 51,403.

import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeBackend } from './fakes/billing-backend';
import { runCharge, type RunCharge } from '@/lib/usage/run-charge';
import { loadRunCharge } from '@/lib/tools/clips-run-charge';

const b = installFakeBackend();

function known(c: RunCharge | null): Exclude<RunCharge, { state: 'none' }> {
  assert.ok(c && c.state !== 'none', `expected a charge, got ${JSON.stringify(c)}`);
  return c;
}
const USER = 'user-qa';
const CLIPS = 'eng-clips';
const RES = 'res-qa';

// That run's three ledger rows, as written by trg_usage_events_price.
const qaEvents = [
  { reservation_id: RES, kind: 'engine.base', billable_tokens: 39_000 },
  { reservation_id: RES, kind: 'compute.seconds', billable_tokens: 9_667 },
  { reservation_id: RES, kind: 'transcription.seconds', billable_tokens: 2_736 },
];

function seed(status = 'succeeded') {
  b.reset();
  b.tables.engines = [
    { id: CLIPS, slug: 'chalybclip' },
    { id: 'eng-other', slug: 'chalybobs' },
  ];
  b.tables.usage_reservations = [
    {
      id: RES,
      user_id: USER,
      engine_id: CLIPS,
      external_job_id: 'ujob_qa',
      status,
      est_tokens: 60_000,
      fee_tokens: 0,
    },
    // Same job id on another engine and another user's run: never counted.
    {
      id: 'res-x',
      user_id: USER,
      engine_id: 'eng-other',
      external_job_id: 'ujob_qa',
      status: 'succeeded',
      est_tokens: 1,
      fee_tokens: 0,
    },
    {
      id: 'res-y',
      user_id: 'someone-else',
      engine_id: CLIPS,
      external_job_id: 'ujob_qa',
      status: 'succeeded',
      est_tokens: 1,
      fee_tokens: 0,
    },
  ];
  b.tables.usage_events = [
    ...qaEvents.map((e, i) => ({ id: `ev-${i}`, user_id: USER, ...e })),
    {
      id: 'ev-x',
      user_id: USER,
      reservation_id: 'res-x',
      kind: 'llm.tokens',
      billable_tokens: 777,
    },
    {
      id: 'ev-y',
      user_id: 'someone-else',
      reservation_id: 'res-y',
      kind: 'llm.tokens',
      billable_tokens: 888,
    },
  ];
}

test('settled QA run: the page shows the 51,403 the balance lost, not 16,052', async () => {
  seed();
  const c = await loadRunCharge(USER, ['ujob_qa']);
  assert.deepEqual(c, {
    state: 'settled',
    charged: 51_403,
    reserved: 0,
    bySource: [
      { kind: 'engine.base', credits: 39_000 },
      { kind: 'compute.seconds', credits: 9_667 },
      { kind: 'transcription.seconds', credits: 2_736 },
    ],
    settling: false,
  });
  assert.deepEqual(b.unsupported, []);
});

test('run still open: what it holds is labelled reserved, same rule as the balance', async () => {
  seed('open');
  b.tables.usage_events = (b.tables.usage_events ?? []).filter(
    (e) => e.kind === 'transcription.seconds',
  );
  const c = await loadRunCharge(USER, ['ujob_qa']);
  assert.equal(c?.state, 'reserved');
  // usage_balance: greatest(0, est − reported) + fee = 60,000 − 2,736.
  assert.equal(known(c).reserved, 57_264);
  assert.equal(known(c).charged, 2_736);
});

test('two runs of one video add up; a cancelled run that reported nothing adds 0', () => {
  const c = runCharge(
    [
      { id: 'r1', status: 'succeeded', est_tokens: 60_000, fee_tokens: 0 },
      { id: 'r2', status: 'cancelled', est_tokens: 60_000, fee_tokens: 0 },
      { id: 'r3', status: 'succeeded', est_tokens: 20_000, fee_tokens: 5_000 },
    ],
    [
      ...qaEvents.map((e) => ({ ...e, reservation_id: 'r1' })),
      { reservation_id: 'r3', kind: 'compute.seconds', billable_tokens: 1_000 },
      { reservation_id: 'r3', kind: 'boost.fee', billable_tokens: 5_000 },
    ],
  );
  assert.equal(c.state, 'settled');
  assert.equal(known(c).charged, 57_403);
  assert.equal(known(c).reserved, 0);
});

test('more ledger rows than one PostgREST page are all counted', async () => {
  seed();
  b.tables.usage_events = Array.from({ length: 2_345 }, (_, i) => ({
    id: `ev-${String(i).padStart(5, '0')}`,
    user_id: USER,
    reservation_id: RES,
    kind: 'llm.tokens',
    billable_tokens: 2,
  }));
  const c = await loadRunCharge(USER, ['ujob_qa']);
  assert.equal(known(c).charged, 4_690);
});

test('no admitted run, an old engine, or a failed read never show as a zero charge', async () => {
  seed();
  assert.deepEqual(await loadRunCharge(USER, []), { state: 'none' });
  assert.equal(await loadRunCharge(USER, undefined), null);
  assert.equal(await loadRunCharge(USER, null), null);
  b.failNext.push({ method: 'GET', table: 'usage_events' });
  const orig = console.error;
  console.error = () => {};
  try {
    assert.equal(await loadRunCharge(USER, ['ujob_qa']), null);
  } finally {
    console.error = orig;
  }
});

test('a crashed run past its TTL no longer shows as reserved, like the balance', () => {
  const now = Date.parse('2026-11-07T12:00:00Z');
  const c = runCharge(
    [
      {
        id: 'r1',
        status: 'open',
        est_tokens: 60_000,
        fee_tokens: 0,
        expires_at: '2026-11-07T11:00:00Z',
      },
    ],
    [{ reservation_id: 'r1', kind: 'compute.seconds', billable_tokens: 9_667 }],
    now,
  );
  assert.equal(c.state, 'settled');
  assert.equal(known(c).reserved, 0);
  assert.equal(known(c).charged, 9_667);
});

test('just settled: keeps refreshing so the base fee reported after the settle shows up', () => {
  const now = Date.parse('2026-11-07T12:00:00Z');
  const row = { id: 'r1', status: 'succeeded', est_tokens: 60_000, fee_tokens: 0 };
  assert.equal(
    known(runCharge([{ ...row, settled_at: '2026-11-07T11:59:30Z' }], [], now)).settling,
    true,
  );
  assert.equal(
    known(runCharge([{ ...row, settled_at: '2026-11-07T11:50:00Z' }], [], now)).settling,
    false,
  );
});
