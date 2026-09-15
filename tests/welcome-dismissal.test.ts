// The "Ahora no" cookie hides the welcome banner only for the user who set it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { isWelcomeDismissedFor } from '@/lib/usage/welcome-dismissal';

const USER = 'a1b2c3d4-0000-4000-8000-000000000001';

test('no cookie → not dismissed', () => {
  assert.equal(isWelcomeDismissedFor(undefined, USER), false);
  assert.equal(isWelcomeDismissedFor('', USER), false);
});

test('the cookie for this user → dismissed, raw or percent-encoded', () => {
  assert.equal(isWelcomeDismissedFor(USER, USER), true);
  assert.equal(isWelcomeDismissedFor(encodeURIComponent(USER), USER), true);
});

test('a cookie left by another account on the same browser does not hide this user’s banner', () => {
  assert.equal(isWelcomeDismissedFor('some-other-user', USER), false);
});

test('a malformed cookie value is ignored', () => {
  assert.equal(isWelcomeDismissedFor('%E0%A4%A', USER), false);
});
