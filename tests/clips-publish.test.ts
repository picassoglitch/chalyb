// Clips → Publicar (Zernio publishing in the hub): the BFF allowlist, the
// ClipsAdapter publishing methods over the engine client, and the pure
// helpers the screens use.

import test from 'node:test';
import assert from 'node:assert/strict';
import { PUBLISH_OPS, matchPublishOp, pickQuery } from '@/lib/tools/adapters/clips/publish-ops';
import {
  CONNECT_PLATFORMS,
  publishMethods,
  publishReturnUrl,
  safeClipsPath,
} from '@/lib/tools/adapters/clips/publish';
import type { ClipsEngine } from '@/lib/tools/adapters/clips/client';
import {
  isPublishTab,
  isTerminalStatus,
  normalizePlatforms,
  statusKind,
} from '@/components/tools/clips/publish/types';

// ── allowlist ────────────────────────────────────────────────────────────

test('only allowlisted operations reach the engine, with ids encoded', () => {
  assert.deepEqual(matchPublishOp('GET', ['overview'])?.enginePath, '/publish/overview');
  assert.equal(
    matchPublishOp('POST', ['post', 'clp_01ABC'])?.enginePath,
    '/publish/post/clp_01ABC',
  );
  assert.equal(
    matchPublishOp('GET', ['status', '6650f0a1b2.json'])?.enginePath,
    '/publish/status/6650f0a1b2.json',
  );
  assert.equal(
    matchPublishOp('POST', ['inbox', 'comments', 'reply'])?.op.pattern,
    'inbox/comments/reply',
  );
  // Wrong method, unknown path, extra segments → nothing.
  assert.equal(matchPublishOp('POST', ['overview']), null);
  assert.equal(matchPublishOp('GET', ['post', 'clp_1']), null);
  assert.equal(matchPublishOp('GET', ['admin', 'tenants']), null);
  assert.equal(matchPublishOp('GET', ['overview', 'x']), null);
  assert.equal(matchPublishOp('GET', []), null);
  assert.equal(matchPublishOp('DELETE', ['overview']), null);
});

test('ids must look like ids: no traversal, no slashes, no empty', () => {
  for (const bad of ['..', '../x', '', '.hidden', 'a/b', 'a?b', 'a b', '%2e%2e', 'x'.repeat(200)])
    assert.equal(matchPublishOp('POST', ['post', bad]), null, bad);
  assert.equal(matchPublishOp('GET', ['status', '.json']), null);
  assert.equal(matchPublishOp('GET', ['status', 'abc']), null); // suffix required
  assert.equal(
    matchPublishOp('POST', ['retry', 'acc_1:2.3-x'])?.enginePath,
    '/publish/retry/acc_1%3A2.3-x',
  );
});

test('every publishing/connecting operation is plan-gated and long ones are marked', () => {
  const byPattern = new Map(PUBLISH_OPS.map((o) => [o.pattern, o]));
  for (const p of ['connect', 'post/:id', 'bulk-post', 'draft/:id/publish', 'schedule/auto'])
    assert.equal(byPattern.get(p)?.socials, true, p);
  for (const p of [
    'post/:id',
    'bulk-post',
    'draft/:id/publish',
    'reprocess-failed',
    'reprocess/:id',
    'growth/broadcasts/send',
    'inbox/conversations/reply',
  ])
    assert.equal(byPattern.get(p)?.publishes, true, p);
  for (const p of ['post/:id', 'bulk-post', 'draft/:id/publish', 'compose/:id'])
    assert.equal(byPattern.get(p)?.long, true, p);
  // Unique (method, pattern).
  const keys = PUBLISH_OPS.map((o) => `${o.method} ${o.pattern}`);
  assert.equal(new Set(keys).size, keys.length);
});

test('GET query keys are allowlisted per operation', () => {
  const cal = matchPublishOp('GET', ['calendar.json'])!.op;
  const q = new URLSearchParams('date_from=2026-10-01&date_to=2026-11-01&tenant_id=evil');
  assert.deepEqual(pickQuery(cal, q), { date_from: '2026-10-01', date_to: '2026-11-01' });
  const overview = matchPublishOp('GET', ['overview'])!.op;
  assert.deepEqual(pickQuery(overview, q), {});
  const long = new URLSearchParams(`q=${'x'.repeat(500)}`);
  assert.equal(
    pickQuery(matchPublishOp('GET', ['growth', 'contacts.json'])!.op, long).q!.length,
    200,
  );
});

// ── return URL ───────────────────────────────────────────────────────────

test('the OAuth return is always this app’s /conectado page', () => {
  const prev = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = 'https://www.chalyb.com';
  try {
    assert.equal(
      publishReturnUrl('es', '/app/clips/publicar'),
      'https://www.chalyb.com/app/clips/publicar/conectado?next=%2Fapp%2Fclips%2Fpublicar',
    );
    assert.equal(
      publishReturnUrl('en', null),
      'https://www.chalyb.com/en/app/clips/publicar/conectado',
    );
    // A next that isn't a Clips screen is dropped, never followed.
    for (const bad of ['https://evil.example', '//evil.example', '/app/billing', '/app/clips/../x'])
      assert.equal(
        publishReturnUrl('es', bad),
        'https://www.chalyb.com/app/clips/publicar/conectado',
        bad,
      );
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prev;
  }
  assert.equal(safeClipsPath('/app/clips/ajustes'), '/app/clips/ajustes');
  assert.equal(safeClipsPath('/app/clips?x=1'), null);
});

// ── ClipsAdapter methods over the engine ─────────────────────────────────

function fakeEngine(answers: Record<string, unknown>, calls: unknown[][] = []): ClipsEngine {
  const request = async <T>(method: string, path: string, opts?: object) => {
    calls.push([method, path, (opts as { body?: unknown } | undefined)?.body]);
    const key = `${method} ${path}`;
    if (!(key in answers)) throw new Error(`unexpected ${key}`);
    return answers[key] as T;
  };
  return {
    userId: 'u1',
    request,
    get: (p, o) => request('GET', p, o),
    post: (p, b, o) => request('POST', p, { ...o, body: b }),
    put: (p, b, o) => request('PUT', p, { ...o, body: b }),
    patch: (p, b, o) => request('PATCH', p, { ...o, body: b }),
    del: (p, o) => request('DELETE', p, o),
    mediaUrl: async (p) => (p ? `https://clips.example${p}` : null),
  };
}

test('accounts maps Zernio accounts onto the hub platforms it can publish to', async () => {
  const m = publishMethods(() =>
    fakeEngine({
      'GET /publish/accounts.json': {
        ok: true,
        accounts: [
          { platform: 'tiktok', account_id: 'a1' },
          { platform: 'TikTok', account_id: 'a2' },
          { platform: 'instagram', account_id: 'a3' },
          { platform: 'youtube', account_id: 'a4' },
        ],
      },
    }),
  );
  assert.deepEqual(await m.accounts('u1'), [
    { platform: 'tiktok', handle: null, connected: true },
    { platform: 'youtube', handle: null, connected: true },
  ]);
});

test('connectUrl returns the engine’s URL for Zernio platforms only', async () => {
  const calls: unknown[][] = [];
  const m = publishMethods(() =>
    fakeEngine({ 'POST /publish/connect': { ok: true, auth_url: 'https://zernio.com/x' } }, calls),
  );
  assert.equal(await m.connectUrl('u1', 'twitch', '/app/clips/ajustes'), null);
  assert.equal(await m.connectUrl('u1', 'tiktok', '/app/clips/ajustes'), 'https://zernio.com/x');
  const body = calls[0]![2] as { platform: string; return_url: string };
  assert.equal(body.platform, 'tiktok');
  assert.match(
    body.return_url,
    /\/app\/clips\/publicar\/conectado\?next=%2Fapp%2Fclips%2Fajustes$/,
  );
});

test('publishClip posts what auto-publish would (composed title + caption)', async () => {
  const calls: unknown[][] = [];
  const m = publishMethods(() =>
    fakeEngine(
      {
        'POST /publish/compose/clp_1': { ok: true, title: 'Gancho', caption: 'Texto #tag' },
        'POST /publish/post/clp_1': { ok: true, queued: 'p1' },
      },
      calls,
    ),
  );
  assert.deepEqual(await m.publishClip('u1', 'clp_1', 'youtube'), { ok: true });
  assert.deepEqual(calls[1]![2], {
    platforms: ['youtube'],
    mode: 'now',
    title: 'Gancho',
    description: 'Texto #tag',
  });
  assert.deepEqual(await m.publishClip('u1', 'clp_1', 'kick'), { ok: false });
});

// ── screen helpers ───────────────────────────────────────────────────────

test('per-platform results normalize from a list or a dict, links http(s) only', () => {
  const list = normalizePlatforms([
    {
      platform: 'tiktok',
      status: 'published',
      url: 'https://tiktok.com/@a/1',
      platformPostId: '1',
    },
    { platform: 'youtube', status: 'failed', errorMessage: 'quota', url: 'javascript:alert(1)' },
  ]);
  assert.equal(list[0]!.ok, true);
  assert.equal(list[0]!.url, 'https://tiktok.com/@a/1');
  assert.equal(list[0]!.postId, '1');
  assert.equal(list[1]!.ok, false);
  assert.equal(list[1]!.status, 'FAILED');
  assert.equal(list[1]!.url, null);
  assert.equal(list[1]!.error, 'quota');
  const dict = normalizePlatforms({ instagram: { success: true }, x: 'pending' });
  assert.deepEqual(
    dict.map((r) => [r.platform, r.ok, r.status]),
    [
      ['instagram', true, 'PUBLISHED'],
      ['x', false, 'PENDING'],
    ],
  );
  assert.deepEqual(normalizePlatforms(null), []);
});

test('status helpers', () => {
  assert.equal(isTerminalStatus('published'), true);
  assert.equal(isTerminalStatus('UNAVAILABLE'), true);
  assert.equal(isTerminalStatus('PUBLISHING'), false);
  assert.equal(statusKind('failed'), 'bad');
  assert.equal(statusKind(''), 'acc');
  assert.equal(statusKind('cancelled'), 'gray');
  assert.equal(isPublishTab('piloto'), true);
  assert.equal(isPublishTab('admin'), false);
});

test('CONNECT_PLATFORMS is the list the adapter methods honour', async () => {
  assert.deepEqual([...CONNECT_PLATFORMS], ['youtube', 'tiktok', 'facebook']);
  const m = publishMethods(() =>
    fakeEngine({ 'POST /publish/connect': { ok: true, auth_url: 'https://zernio.com/x' } }),
  );
  for (const p of ['youtube', 'twitch', 'tiktok', 'kick', 'facebook'] as const)
    assert.equal(
      (await m.connectUrl('u1', p, '/app/clips/ajustes')) !== null,
      CONNECT_PLATFORMS.includes(p),
      p,
    );
});
