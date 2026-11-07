// QA 2026-11-06: one Clips run took 51,403 credits from a Pro balance, but
// Movimientos listed it as three rows of −0: only llm.tokens events were
// counted. These are that run's three events as the engine reported them.

import test from 'node:test';
import assert from 'node:assert/strict';
import { eventCredits, groupUses, retryWithLegacyColumns, type UsageEventRow } from '@/lib/usage/ledger';

const CLIPS = 'eng-clips';
const AT = '2026-11-07T01:20:52Z';
const base: UsageEventRow = {
  id: 'e1',
  engine_id: CLIPS,
  kind: 'engine.base',
  amount: 1,
  occurred_at: AT,
  operation: 'pipeline_run',
  billable_tokens: 39_000,
};
const compute: UsageEventRow = {
  id: 'e2',
  engine_id: CLIPS,
  kind: 'compute.seconds',
  amount: 169,
  occurred_at: AT,
  operation: 'clips.pipeline',
  billable_tokens: 9_667,
};
const run: UsageEventRow[] = [
  base,
  compute,
  {
    id: 'e3',
    engine_id: CLIPS,
    kind: 'transcription.seconds',
    amount: 101,
    occurred_at: AT,
    operation: 'transcribe',
    billable_tokens: 2_736,
  },
];

test('every meter shows the credits it took, adding up to the balance', () => {
  const uses = [...groupUses(run).values()];
  assert.equal(uses.length, 3);
  assert.ok(
    uses.every((u) => u.credits > 0),
    'no −0 rows',
  );
  assert.equal(
    uses.reduce((n, u) => n + u.credits, 0),
    51_403,
  );
});

test('events of one operation and day are one use', () => {
  const two = [
    compute,
    { ...compute, id: 'e4', billable_tokens: 100, occurred_at: '2026-11-07T03:00:00Z' },
  ];
  const [u] = [...groupUses(two).values()];
  assert.ok(u);
  assert.equal(u.credits, 9_767);
  assert.equal(u.at, '2026-11-07T03:00:00Z');
});

test('without billable_tokens (legacy query) only LLM tokens count, as before', () => {
  assert.equal(eventCredits({ ...compute, billable_tokens: undefined }), 0);
  assert.equal(
    eventCredits({ ...compute, kind: 'llm.tokens', amount: 500, billable_tokens: null }),
    500,
  );
  assert.equal(eventCredits({ ...base, billable_tokens: 0 }), 0);
});

test('only a missing column falls back to the legacy select', () => {
  assert.equal(retryWithLegacyColumns({ code: '42703' }), true);
  for (const code of ['57014', 'PGRST301', '08006', undefined, null])
    assert.equal(retryWithLegacyColumns({ code }), false, String(code));
});
