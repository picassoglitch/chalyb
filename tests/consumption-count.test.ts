// Mi plan's quota bars count what admit_usage() counts: an abandoned job
// (expired, no usage reported) no longer uses the month.

import test from 'node:test';
import assert from 'node:assert/strict';
import { countedReservations } from '@/lib/usage/consumption-core';

test('cancelled and abandoned reservations do not count; failed and reported ones do', () => {
  const rows = [
    { id: 'ok', status: 'succeeded', source_minutes: 3 },
    { id: 'run', status: 'open', source_minutes: 1 },
    { id: 'bad', status: 'failed', source_minutes: 2 },
    { id: 'cxl', status: 'cancelled', source_minutes: 5 },
    { id: 'gone', status: 'expired', source_minutes: 5 },
    { id: 'used', status: 'expired', source_minutes: 4 },
  ];
  const counted = countedReservations(rows, new Set(['used']));
  assert.deepEqual(
    counted.map((r) => r.id),
    ['ok', 'run', 'bad', 'used'],
  );
});
