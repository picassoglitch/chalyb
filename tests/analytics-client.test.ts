import test from 'node:test';
import assert from 'node:assert/strict';
import { trackClient } from '@/lib/analytics/track-client';

async function inBrowser(
  run: (browser: { setConsent: (value: string) => void; calls: unknown[][] }) => Promise<void>,
) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  let cookie = 'chalyb_consent=v1.a1.p1';
  const calls: unknown[][] = [];
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { va: (...args: unknown[]) => calls.push(args) },
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      get cookie() {
        return cookie;
      },
    },
  });
  try {
    await run({
      setConsent: (value) => {
        cookie = `chalyb_consent=${value}`;
      },
      calls,
    });
  } finally {
    for (const [key, original] of [
      ['window', originalWindow],
      ['document', originalDocument],
    ] as const) {
      if (original) Object.defineProperty(globalThis, key, original);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

test('client events are not dispatched without analytics consent', async () => {
  await inBrowser(async ({ setConsent, calls }) => {
    setConsent('v1.a0.p0');
    assert.equal(await trackClient('landing_view', { utm_source: 'launch' }), false);
    assert.deepEqual(calls, []);
  });
});

test('advertising withdrawal during provider import removes campaign properties', async () => {
  await inBrowser(async ({ setConsent, calls }) => {
    const pending = trackClient('landing_view', { page: 'landing', utm_source: 'launch' });
    setConsent('v1.a1.p0');
    assert.equal(await pending, true);
    assert.equal(calls.length, 1);
    const [kind, payload] = calls[0] as [string, { name: string; data: Record<string, unknown> }];
    assert.equal(kind, 'event');
    assert.equal(payload.name, 'landing_view');
    assert.deepEqual(payload.data, { page: 'landing' });
  });
});

test('analytics withdrawal during import suppresses dispatch and permits a later retry', async () => {
  await inBrowser(async ({ setConsent, calls }) => {
    const pending = trackClient('landing_view', { page: 'landing' });
    setConsent('v1.a0.p0');
    assert.equal(await pending, false);
    assert.deepEqual(calls, []);
    setConsent('v1.a1.p1');
    assert.equal(await trackClient('landing_view', { page: 'landing' }), true);
    assert.equal(calls.length, 1);
  });
});
