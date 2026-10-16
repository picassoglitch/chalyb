import test from 'node:test';
import assert from 'node:assert/strict';
import { createSetupPoller, type PollEnv } from '@/lib/chalito/web/setup-poll';

// First Run D: one timer for every setup checklist on the page, paused while the tab is hidden.

const fakeEnv = () => {
  let hidden = false;
  let nextId = 1;
  const timers = new Map<number, () => void>();
  const listeners = new Set<() => void>();
  const env: PollEnv = {
    setInterval: (run) => {
      const id = nextId++;
      timers.set(id, run);
      return id;
    },
    clearInterval: (id) => void timers.delete(id as number),
    isHidden: () => hidden,
    onVisibility: (run) => {
      listeners.add(run);
      return () => listeners.delete(run);
    },
  };
  return {
    env,
    timers,
    listeners,
    fire: () => [...timers.values()].forEach((run) => run()),
    setHidden: (h: boolean) => {
      hidden = h;
      listeners.forEach((run) => run());
    },
  };
};

test('two checklists on one store share one timer, and it stops when both are gone', () => {
  const f = fakeEnv();
  const poll = createSetupPoller(f.env, 15_000);
  const store = {};
  let reads = 0;
  const resync = async () => void reads++;
  const a = poll(store, resync);
  const b = poll(store, resync);
  assert.equal(f.timers.size, 1);
  f.fire();
  assert.equal(reads, 1);
  a();
  a(); // releasing twice is harmless
  assert.equal(f.timers.size, 1);
  b();
  assert.equal(f.timers.size, 0);
  assert.equal(f.listeners.size, 0);
});

test('hidden tab: no timer; back to visible: one read right away, then the timer again', () => {
  const f = fakeEnv();
  const poll = createSetupPoller(f.env, 15_000);
  let reads = 0;
  const release = poll({}, async () => void reads++);
  f.setHidden(true);
  assert.equal(f.timers.size, 0);
  f.setHidden(false);
  assert.equal(reads, 1);
  assert.equal(f.timers.size, 1);
  release();
});

test('starting while hidden waits for the tab to be visible', () => {
  const f = fakeEnv();
  f.setHidden(true);
  const poll = createSetupPoller(f.env, 15_000);
  let reads = 0;
  const release = poll({}, async () => void reads++);
  assert.equal(f.timers.size, 0);
  f.setHidden(false);
  assert.equal(reads, 1);
  assert.equal(f.timers.size, 1);
  release();
});

test('a failing re-read never throws out of the timer', () => {
  const f = fakeEnv();
  const poll = createSetupPoller(f.env, 15_000);
  const release = poll({}, async () => {
    throw new Error('offline');
  });
  assert.doesNotThrow(() => f.fire());
  release();
});
