// Mi plan's quota bars count what admit_usage() counts: an abandoned job
// (expired, no usage reported) and the month's first 3 failed jobs don't
// use the month (owner 2026-11-07).

import test from 'node:test';
import assert from 'node:assert/strict';
import { countedReservations, FREE_FAILED_RETRIES } from '@/lib/usage/consumption-core';

const at = (min: number) => new Date(Date.UTC(2026, 10, 1, 0, min)).toISOString();

test('cancelled, abandoned and failed reservations do not count; reported ones do', () => {
  const rows = [
    { id: 'ok', status: 'succeeded', source_minutes: 3, created_at: at(1) },
    { id: 'run', status: 'open', source_minutes: 1, created_at: at(2) },
    { id: 'bad', status: 'failed', source_minutes: 2, created_at: at(3) },
    { id: 'cxl', status: 'cancelled', source_minutes: 5, created_at: at(4) },
    { id: 'gone', status: 'expired', source_minutes: 5, created_at: at(5) },
    { id: 'used', status: 'expired', source_minutes: 4, created_at: at(6) },
  ];
  const counted = countedReservations(rows, new Set(['used']));
  assert.deepEqual(
    counted.map((r) => r.id),
    ['ok', 'run', 'used'],
  );
});

test('only the first 3 failed jobs of the month are free; the 4th on count', () => {
  assert.equal(FREE_FAILED_RETRIES, 3);
  // Out of order on purpose: the rule goes by created_at, not row order.
  const rows = [
    { id: 'f5', status: 'failed', source_minutes: 50, created_at: at(50) },
    { id: 'f2', status: 'failed', source_minutes: 20, created_at: at(20) },
    { id: 'ok', status: 'succeeded', source_minutes: 7, created_at: at(5) },
    { id: 'f4', status: 'failed', source_minutes: 40, created_at: at(40) },
    { id: 'f1', status: 'failed', source_minutes: 10, created_at: at(10) },
    { id: 'f3', status: 'failed', source_minutes: 30, created_at: at(30) },
  ];
  const counted = countedReservations(rows, new Set());
  assert.deepEqual(counted.map((r) => r.id).sort(), ['f4', 'f5', 'ok']);
  assert.equal(
    counted.reduce((s, r) => s + Number(r.source_minutes), 0),
    97,
  );
});

test('abandoned and cancelled runs do not use up a free retry', () => {
  const rows = [
    { id: 'gone', status: 'expired', source_minutes: 1, created_at: at(1) },
    { id: 'cxl', status: 'cancelled', source_minutes: 1, created_at: at(2) },
    { id: 'f1', status: 'failed', source_minutes: 1, created_at: at(3) },
    { id: 'f2', status: 'failed', source_minutes: 1, created_at: at(4) },
    { id: 'f3', status: 'failed', source_minutes: 1, created_at: at(5) },
  ];
  assert.deepEqual(countedReservations(rows, new Set()), []);
});

test('same millisecond: microseconds, then id, decide like the SQL', () => {
  const rows = [
    { id: 'b', status: 'failed', source_minutes: 1, created_at: '2026-11-01T00:00:00.000200+00:00' },
    { id: 'a', status: 'failed', source_minutes: 1, created_at: '2026-11-01T00:00:00.000200+00:00' },
    { id: 'c', status: 'failed', source_minutes: 1, created_at: '2026-11-01T00:00:00.000100+00:00' },
    { id: 'd', status: 'failed', source_minutes: 1, created_at: '2026-11-01T00:00:00.000300+00:00' },
  ];
  assert.deepEqual(
    countedReservations(rows, new Set()).map((r) => r.id),
    ['d'],
  );
});

test('PostgREST drops trailing zeros: the text still sorts in time order', () => {
  const rows = [
    { id: 'x', status: 'failed', source_minutes: 1, created_at: '2026-11-01T00:00:00.0002+00:00' },
    { id: 'y', status: 'failed', source_minutes: 1, created_at: '2026-11-01T00:00:00+00:00' },
    { id: 'z', status: 'failed', source_minutes: 1, created_at: '2026-11-01T00:00:00.0001+00:00' },
    { id: 'w', status: 'failed', source_minutes: 1, created_at: '2026-11-01T00:00:00.00015+00:00' },
  ];
  assert.deepEqual(
    countedReservations(rows, new Set()).map((r) => r.id),
    ['x'],
  );
});
