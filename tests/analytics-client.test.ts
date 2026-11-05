import test from 'node:test';
import assert from 'node:assert/strict';
import { trackClient } from '@/lib/analytics/track-client';
import { withoutFragment } from '@/lib/analytics-url';

type Browser = {
  setConsent: (value: string) => void;
  calls: unknown[][];
  win: Record<string, unknown>;
};

async function inBrowser(run: (browser: Browser) => Promise<void>, { scriptLoaded = true } = {}) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  let cookie = 'chalyb_consent=v1.a1.p1';
  const calls: unknown[][] = [];
  // scriptLoaded=false: window.va is undefined, as before <Analytics /> has run.
  const win: Record<string, unknown> = scriptLoaded
    ? { va: (...args: unknown[]) => calls.push(args) }
    : {};
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
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
      win,
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

test('an event sent before the analytics script loads is queued for it', async () => {
  await inBrowser(
    async ({ setConsent, win }) => {
      setConsent('v1.a1.p0');
      assert.equal(
        await trackClient('landing_view', { page: 'landing', utm_source: 'launch' }),
        true,
      );
      assert.equal(typeof win.va, 'function');
      assert.deepEqual(win.vaq, [
        ['beforeSend', withoutFragment],
        ['event', { name: 'landing_view', data: { page: 'landing' }, options: undefined }],
      ]);
      // Replay like the script does (in order, beforeSend sets the transform): no fragment leaks.
      let transform = (e: { url: string }) => e;
      const sent: string[] = [];
      for (const [kind, arg] of win.vaq as [string, unknown][]) {
        if (kind === 'beforeSend') transform = arg as typeof transform;
        else sent.push(transform({ url: 'https://chalyb.com/?x=1#c=pairing' }).url);
      }
      assert.deepEqual(sent, ['https://chalyb.com/?x=1']);
      // The real script replays vaq through its own va; a second early event joins the same queue.
      assert.equal(await trackClient('landing_cta_click'), true);
      assert.equal((win.vaq as unknown[]).length, 3);
    },
    { scriptLoaded: false },
  );
});

test('withdrawal during import with no script loaded queues nothing, and a later retry queues', async () => {
  await inBrowser(
    async ({ setConsent, win }) => {
      const pending = trackClient('landing_view', { page: 'landing' });
      setConsent('v1.a0.p0');
      assert.equal(await pending, false);
      assert.equal(win.va, undefined);
      assert.equal(win.vaq, undefined);
      setConsent('v1.a1.p1');
      assert.equal(await trackClient('landing_view', { page: 'landing' }), true);
      assert.deepEqual(win.vaq, [
        ['beforeSend', withoutFragment],
        ['event', { name: 'landing_view', data: { page: 'landing' }, options: undefined }],
      ]);
    },
    { scriptLoaded: false },
  );
});

test('an already loaded script receives the event directly, without a queue', async () => {
  await inBrowser(async ({ calls, win }) => {
    assert.equal(await trackClient('landing_view', { page: 'landing' }), true);
    assert.equal(calls.length, 1);
    assert.equal(win.vaq, undefined);
  });
});
