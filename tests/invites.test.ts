// The team invite form's pending list and role gate.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INVITABLE_ROLES,
  friendlyInviteError,
  isInvitableRole,
  pendingInvitesFrom,
} from '@/lib/auth/invites';

test('SUPER_ADMIN cannot be handed out by an invite', () => {
  assert.equal(isInvitableRole('SUPER_ADMIN'), false);
  assert.equal(isInvitableRole('ADMIN'), true);
  assert.equal(isInvitableRole('nonsense'), false);
  assert.ok(!INVITABLE_ROLES.includes('SUPER_ADMIN'));
});

test('pending = invited, never signed in, with an email; newest first', () => {
  const pending = pendingInvitesFrom([
    { id: 'a', email: 'a@x.mx', invited_at: '2026-09-10T00:00:00Z' },
    {
      id: 'b',
      email: 'b@x.mx',
      invited_at: '2026-09-14T00:00:00Z',
      user_metadata: { invited_role: 'EDITOR' },
    },
    {
      id: 'c',
      email: 'c@x.mx',
      invited_at: '2026-09-12T00:00:00Z',
      last_sign_in_at: '2026-09-13T00:00:00Z',
    },
    { id: 'd', email: 'd@x.mx' },
    { id: 'e', invited_at: '2026-09-15T00:00:00Z' },
  ]);
  assert.deepEqual(
    pending.map((p) => [p.id, p.role]),
    [
      ['b', 'EDITOR'],
      ['a', null],
    ],
  );
});

test('a duplicate email gets a human message', () => {
  assert.match(
    friendlyInviteError('A user with this email address has already been registered'),
    /ya tiene cuenta/,
  );
  assert.equal(friendlyInviteError('something else'), 'something else');
});
