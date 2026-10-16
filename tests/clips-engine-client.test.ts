// Clips mode "a" foundation: the engine client (token per request, URL
// building, error mapping onto the BFF's normalized errors) and the new
// consumption refusal reasons.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mintEngineApiToken } from '@/lib/engines/integrations/api-token';
import {
  absoluteMediaUrl,
  buildEngineUrl,
  clipsEngine,
  seg,
  type ClipsEngineDeps,
} from '@/lib/tools/adapters/clips/client';
import {
  ClipsEngineError,
  codeForStatus,
  engineErrorFrom,
} from '@/lib/tools/adapters/clips/errors';
import {
  countsAsOutage,
  failureEffect,
  isAdapterError,
  normalizeToolError,
  statusForReason,
} from '@/lib/tools/bff-core';

const ID = {
  userId: 'u1',
  email: 'ana@example.com',
  tenantId: 'ten_1',
  tier: 'pro',
  baseUrl: 'https://clips.example',
};

function fakeDeps(
  respond: (url: string, init: RequestInit) => Response | Promise<Response>,
  seen: { url?: string; init?: RequestInit; forgot?: number; minted?: unknown[] } = {},
): ClipsEngineDeps {
  seen.forgot = 0;
  seen.minted = [];
  return {
    fetch: (async (url: string, init: RequestInit) => {
      seen.url = url;
      seen.init = init;
      return respond(url, init);
    }) as unknown as typeof fetch,
    identity: async () => ID,
    mint: (claims) => {
      seen.minted!.push(claims);
      return `tok-${seen.minted!.length}`;
    },
    forget: () => {
      seen.forgot! += 1;
    },
  };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('launch token: same shape and HMAC the engine verifies', () => {
  const tok = mintEngineApiToken(
    'chalybclip',
    { user_id: 'u1', email: 'a@b.co', tenant_id: 'ten_1', tier: 'pro' },
    { secret: 's3cret', nowMs: 1_000_000, ttlSeconds: 120 },
  );
  const [body = '', sig] = tok.split('.');
  assert.equal(sig, createHmac('sha256', 's3cret').update(body).digest('base64url'));
  assert.deepEqual(JSON.parse(Buffer.from(body, 'base64url').toString()), {
    user_id: 'u1',
    email: 'a@b.co',
    tenant_id: 'ten_1',
    tier: 'pro',
    exp: 1000 + 120,
  });
});

test('launch token: refuses to mint without the secret', () => {
  const prev = process.env.CHALYBCLIP_SSO_SECRET;
  delete process.env.CHALYBCLIP_SSO_SECRET;
  try {
    assert.throws(
      () =>
        mintEngineApiToken('chalybclip', {
          user_id: 'u',
          email: 'e',
          tenant_id: 't',
          tier: 'free',
        }),
      /CHALYBCLIP_SSO_SECRET/,
    );
  } finally {
    if (prev !== undefined) process.env.CHALYBCLIP_SSO_SECRET = prev;
  }
});

test('engine URL: prefix, query, and no path tricks', () => {
  assert.equal(
    buildEngineUrl('https://x.test', '/streams', { limit: 5, q: 'a b', skip: undefined }),
    'https://x.test/api/hub/v1/streams?limit=5&q=a+b',
  );
  assert.throws(() => buildEngineUrl('https://x.test', 'streams'));
  assert.throws(() => buildEngineUrl('https://x.test', '/../admin'));
  assert.throws(() => buildEngineUrl('https://x.test', '//evil.test/x'));
  assert.equal(seg('a/b?c'), 'a%2Fb%3Fc');
});

test('client: fresh bearer per request, JSON in and out', async () => {
  const seen: Parameters<typeof fakeDeps>[1] = {};
  const engine = clipsEngine(
    'u1',
    fakeDeps(() => json(200, { hello: 'world' }), seen),
  );
  assert.deepEqual(await engine.post('/things', { a: 1 }), { hello: 'world' });
  assert.equal(seen.url, 'https://clips.example/api/hub/v1/things');
  const headers = seen.init!.headers as Record<string, string>;
  assert.equal(headers.Authorization, 'Bearer tok-1');
  assert.equal(headers['Content-Type'], 'application/json');
  assert.equal(seen.init!.body, '{"a":1}');
  assert.equal(seen.init!.redirect, 'manual');
  await engine.get('/things');
  assert.equal((seen.init!.headers as Record<string, string>).Authorization, 'Bearer tok-2');
  assert.deepEqual(seen.minted![0], {
    user_id: 'u1',
    email: 'ana@example.com',
    tenant_id: 'ten_1',
    tier: 'pro',
  });
});

test('client: engine refusals become normalized, marked errors', async () => {
  const cases: [number, unknown, string, string | undefined][] = [
    [
      402,
      { ok: false, error: { code: 'no_credits', message: 'Sin tokens', reason: 'no_tokens' } },
      'no_credits',
      'no_tokens',
    ],
    [
      429,
      { ok: false, error: { code: 'rate_limited', message: 'x', reason: 'minutes_cap' } },
      'rate_limited',
      'minutes_cap',
    ],
    [
      413,
      { ok: false, error: { code: 'too_large', message: 'x', reason: 'upload_too_large' } },
      'too_large',
      'upload_too_large',
    ],
    [
      402,
      { ok: false, error: { code: 'needs_plan', message: 'x', reason: 'paywall_paid' } },
      'needs_plan',
      'paywall_paid',
    ],
    [
      404,
      { ok: false, error: { code: 'not_found', message: 'x', reason: null } },
      'not_found',
      undefined,
    ],
    [500, '<html>boom</html>', 'unknown', undefined],
    [503, null, 'unknown', undefined],
  ];
  for (const [status, body, reason, refusal] of cases) {
    const engine = clipsEngine(
      'u1',
      fakeDeps(() =>
        typeof body === 'string' ? new Response(body, { status }) : json(status, body),
      ),
    );
    const err = await engine.get('/x').then(
      () => assert.fail('should throw'),
      (e: unknown) => e,
    );
    assert.ok(err instanceof ClipsEngineError);
    assert.ok(isAdapterError(err), 'marked as an engine error');
    const n = normalizeToolError(err);
    assert.equal(n.reason, reason, `status ${status}`);
    assert.equal(n.refusal, refusal);
  }
});

test('client: 401 forgets the cached identity; network errors are engine errors', async () => {
  const seen: Parameters<typeof fakeDeps>[1] = {};
  const engine = clipsEngine(
    'u1',
    fakeDeps(() => json(401, { ok: false, error: { code: 'unauthorized', message: 'x' } }), seen),
  );
  const err = await engine.get('/x').catch((e) => e);
  assert.equal(seen.forgot, 1);
  // A refused token is the hub↔engine link failing: an outage, not the person.
  assert.equal(failureEffect(err, { adapterErrorsOnly: true }).outage, true);

  const down = clipsEngine(
    'u1',
    fakeDeps(() => {
      throw new TypeError('fetch failed');
    }),
  );
  const e2 = await down.get('/x').catch((e) => e);
  assert.ok(e2 instanceof ClipsEngineError);
  assert.equal(e2.engineCode, 'network');
  assert.equal(failureEffect(e2, { adapterErrorsOnly: true }).outage, true);
});

test('refusal reasons: person state, never an outage; right HTTP status', () => {
  for (const [reason, status] of [
    ['no_credits', 402],
    ['rate_limited', 429],
    ['too_large', 413],
  ] as const) {
    assert.equal(countsAsOutage(reason), false);
    assert.equal(statusForReason(reason), status);
  }
  // A refusal reason must be a safe identifier, never free text.
  const e = engineErrorFrom(429, { error: { code: 'rate_limited', reason: 'DROP TABLE; --' } });
  assert.equal(e.refusal, null);
  assert.equal(codeForStatus(418), 'bad_request');
  assert.equal(codeForStatus(502), 'internal');
});

test('media URLs: only signed engine media paths become absolute', async () => {
  assert.equal(
    absoluteMediaUrl('https://e.test', '/api/hub/media/clip/c1?t=x&exp=1&sig=s'),
    'https://e.test/api/hub/media/clip/c1?t=x&exp=1&sig=s',
  );
  assert.equal(absoluteMediaUrl('https://e.test', '/dashboard/x'), null);
  assert.equal(absoluteMediaUrl('https://e.test', 'https://evil.test/x'), null);
  assert.equal(absoluteMediaUrl('https://e.test', '/api/hub/media/../v1/me'), null);
  assert.equal(absoluteMediaUrl('https://e.test', null), null);
  const engine = clipsEngine(
    'u1',
    fakeDeps(() => json(200, {})),
  );
  assert.equal(
    await engine.mediaUrl('/api/hub/media/thumb/c1?sig=1'),
    'https://clips.example/api/hub/media/thumb/c1?sig=1',
  );
  assert.equal(await engine.mediaUrl('/x'), null);
});
