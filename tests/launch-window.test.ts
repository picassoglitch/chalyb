// The popup half of "Abrir" (P0-1): the tab opens on the click and is filled
// in later; a blocked tab turns into a link; a refusal closes the tab.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  finishLaunch,
  openLaunchWindow,
  type LaunchWindow,
} from '@/components/workspace/launch-window';

function fakeWindow() {
  const w = {
    location: { href: 'about:blank' },
    opener: {} as unknown,
    closed: false,
    close() {
      this.closed = true;
    },
  };
  return w as LaunchWindow & { closed: boolean };
}

test('opens about:blank in a new tab, without noopener', () => {
  const calls: [string, string][] = [];
  const w = fakeWindow();
  const opened = openLaunchWindow((url, target) => {
    calls.push([url, target]);
    return w;
  });
  assert.equal(opened, w);
  assert.deepEqual(calls, [['about:blank', '_blank']]);
});

test('success fills the tab and cuts the opener', () => {
  const w = fakeWindow();
  assert.deepEqual(finishLaunch(w, { ok: true, url: 'https://clip.example/auth/sso?token=t' }), {
    kind: 'opened',
  });
  assert.equal(w.location.href, 'https://clip.example/auth/sso?token=t');
  assert.equal(w.opener, null);
});

test('popup blocked (null window) → a visible link to the URL', () => {
  assert.equal(
    openLaunchWindow(() => null),
    null,
  );
  assert.deepEqual(finishLaunch(null, { ok: true, url: 'https://x/auth/sso?token=t' }), {
    kind: 'blocked',
    url: 'https://x/auth/sso?token=t',
  });
});

test('open() throwing counts as blocked', () => {
  assert.equal(
    openLaunchWindow(() => {
      throw new Error('blocked');
    }),
    null,
  );
});

test('a refusal closes the blank tab and reports the code', () => {
  const w = fakeWindow();
  assert.deepEqual(finishLaunch(w, { ok: false, code: 'NEEDS_PLAN' }), {
    kind: 'error',
    code: 'NEEDS_PLAN',
  });
  assert.equal(w.closed, true);
});
