// `next` and `state` on /auth/launch/<slug>: what survives to the engine's
// /auth/sso, and what is dropped.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  launchForwardQuery,
  readLaunchForward,
  sanitizeLaunchForward,
} from '@/lib/engines/launch-forward';
import { createEngineIntegration } from '@/lib/engines/integrations/factory';

const STATE = 'A'.repeat(43);

test('keeps a relative next and a base64url state', () => {
  const f = readLaunchForward(new URLSearchParams({ next: '/n/abc?x=1', state: STATE }));
  assert.deepEqual(f, { next: '/n/abc?x=1', state: STATE });
});

test('drops off-site next and malformed state, keeps the rest', () => {
  for (const next of ['https://evil.com', '//evil.com', '/\\evil.com', '%2F%2Fevil.com', 'n/abc']) {
    assert.deepEqual(sanitizeLaunchForward({ next, state: STATE }), { state: STATE });
  }
  for (const state of ['short', 'has space'.padEnd(20, 'x'), 'a'.repeat(129), 'x/y'.repeat(8)]) {
    assert.deepEqual(sanitizeLaunchForward({ next: '/a', state }), { next: '/a' });
  }
  assert.deepEqual(sanitizeLaunchForward(null), {});
  assert.deepEqual(sanitizeLaunchForward({ next: null, state: null }), {});
});

test('rebuilds the query for the sign-in bounce', () => {
  assert.equal(launchForwardQuery({}), '');
  assert.equal(
    launchForwardQuery({ next: '/n/a b', state: STATE }),
    `?next=%2Fn%2Fa+b&state=${STATE}`,
  );
});

const engine = {
  id: 'e',
  slug: 'demo',
  name: 'Demo',
  externalUrl: 'https://demo.example',
  adminApiBase: 'https://demo.example/admin',
  integrationMode: 'external_sso_redirect',
  requiresProvisioning: true,
} as never;

const input = {
  userId: 'u1',
  email: 'a@b.c',
  effectiveTier: 'PRO' as const,
  externalUserId: 'ten_1',
  credentials: null,
  engine,
};

async function launchUrl(
  postSsoPath: string | undefined,
  extra: { next?: string; state?: string },
) {
  process.env.DEMO_SSO_SECRET = 'secret';
  try {
    const integration = createEngineIntegration({ slug: 'demo', displayName: 'Demo', postSsoPath });
    const result = await integration.buildLaunchUrl({ ...input, ...extra });
    assert.equal(result.ok, true);
    return new URL(result.url!);
  } finally {
    delete process.env.DEMO_SSO_SECRET;
  }
}

test('the engine URL carries next (over postSsoPath) and state', async () => {
  const url = await launchUrl('/dashboard', { next: '/n/abc', state: STATE });
  assert.equal(url.pathname, '/auth/sso');
  assert.ok(url.searchParams.get('token'));
  assert.equal(url.searchParams.get('next'), '/n/abc');
  assert.equal(url.searchParams.get('state'), STATE);
});

test('without them the URL is what it was', async () => {
  const withDefault = await launchUrl('/dashboard', {});
  assert.equal(withDefault.searchParams.get('next'), '/dashboard');
  assert.equal(withDefault.searchParams.has('state'), false);
  const bare = await launchUrl(undefined, {});
  assert.deepEqual([...bare.searchParams.keys()], ['token']);
});
