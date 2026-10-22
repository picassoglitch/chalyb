import test from 'node:test';
import assert from 'node:assert/strict';
import { joinRoom } from '../src/lib/chalito/pkg/rooms/room-controller';

const failing = (status: number) => ({
  post: async () => {
    throw Object.assign(new Error('x'), { status });
  },
});

test('rooms join: api statuses map to what the person is told', async () => {
  const code = 'ABCD-EFGH';
  const cases: [number, string][] = [
    [400, 'bad_code'],
    [404, 'bad_code'],
    [410, 'bad_code'],
    [402, 'full'],
    // The database's PT409 "already a member" (it used to fall through to "failed").
    [409, 'already'],
    [429, 'rate_limited'],
    [500, 'failed'],
  ];
  for (const [status, reason] of cases)
    assert.deepEqual(await joinRoom(failing(status) as never, 'chl_x', code), { ok: false, reason }, String(status));
});

test('rooms join: every reason has copy in both languages', async () => {
  const { readFileSync } = await import('node:fs');
  for (const l of ['es', 'en']) {
    const m = JSON.parse(readFileSync(new URL(`../src/lib/chalito/messages/${l}.json`, import.meta.url), 'utf8'));
    for (const r of ['bad_code', 'full', 'already', 'rate_limited', 'failed'])
      assert.equal(typeof m.settings.rooms.error[r], 'string', `${l} ${r}`);
    assert.equal(typeof m.live.devices.thisDevice, 'string', `${l} thisDevice`);
  }
});
