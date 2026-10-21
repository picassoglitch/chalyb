// AutoRefresh's schedule (armRefresh): a refresh that stays pending is
// retried, so a Clips job page never stops re-reading.

import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { STUCK_MS, armRefresh } from '@/lib/tools/clips-refresh';

function setup() {
  mock.timers.enable({ apis: ['setTimeout'] });
  let fired = 0;
  return { fire: () => fired++, fired: () => fired };
}

test('settled: one refresh after everyMs, none after cancel', (t) => {
  const s = setup();
  t.after(() => mock.timers.reset());
  const cancel = armRefresh({ pending: false, cameBack: false, everyMs: 2000 }, s.fire);
  mock.timers.tick(1999);
  assert.equal(s.fired(), 0);
  mock.timers.tick(1);
  assert.equal(s.fired(), 1);
  mock.timers.tick(60_000);
  assert.equal(s.fired(), 1, 'the next one is armed by the caller once this one settles');
  cancel();
});

test('settled, tab just came back: refresh at once', (t) => {
  const s = setup();
  t.after(() => mock.timers.reset());
  armRefresh({ pending: false, cameBack: true, everyMs: 2000 }, s.fire);
  mock.timers.tick(0);
  assert.equal(s.fired(), 1);
});

test('stuck pending: a retry every STUCK_MS until cancelled', (t) => {
  const s = setup();
  t.after(() => mock.timers.reset());
  const cancel = armRefresh({ pending: true, cameBack: false, everyMs: 2000 }, s.fire);
  mock.timers.tick(STUCK_MS - 1);
  assert.equal(s.fired(), 0, 'a refresh that is only slow is left alone');
  mock.timers.tick(1);
  assert.equal(s.fired(), 1);
  mock.timers.tick(STUCK_MS);
  assert.equal(s.fired(), 2);
  cancel();
  mock.timers.tick(5 * STUCK_MS);
  assert.equal(s.fired(), 2, 'cancel (settled, hidden or unmounted) stops the retries');
});

test('stuck pending on a slow page: retries at twice its interval', (t) => {
  const s = setup();
  t.after(() => mock.timers.reset());
  armRefresh({ pending: true, cameBack: false, everyMs: 8000 }, s.fire);
  mock.timers.tick(15_999);
  assert.equal(s.fired(), 0);
  mock.timers.tick(1);
  assert.equal(s.fired(), 1);
});

test('stuck pending, tab just came back: retry at once, then every STUCK_MS', (t) => {
  const s = setup();
  t.after(() => mock.timers.reset());
  armRefresh({ pending: true, cameBack: true, everyMs: 2000 }, s.fire);
  mock.timers.tick(0);
  assert.equal(s.fired(), 1);
  mock.timers.tick(STUCK_MS);
  assert.equal(s.fired(), 2);
});
