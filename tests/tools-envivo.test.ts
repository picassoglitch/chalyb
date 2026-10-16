// En vivo (TOOLS-SPEC §6): pure helpers, the engine credential, the BFF
// helpers, the real engine adapter against a fake engine, and the mock.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MASKED_KEY,
  formatDuration,
  maskKey,
  recentSignIn,
  REVEAL_MAX_ATTEMPTS,
  REVEAL_WINDOW_MS,
  revealAttemptAllowed,
  sessionAuthTimeMs,
} from '@/lib/tools/envivo-core';
import { createMockEnVivo } from '@/lib/tools/adapters/mock-tools';
import {
  API_AUD,
  PREVIEW_AUD,
  mintEngineToken,
  safePreviewPath,
  signEngineToken,
  verifyEngineToken,
} from '@/lib/tools/envivo-token';
import {
  decodePending,
  backToStudio,
  encodePending,
  newOAuthPending,
  parseDestinationPatch,
  parseDestinationId,
  pendingMatches,
  pkceChallenge,
  previewUrlFor,
} from '@/lib/tools/envivo-bff';
import { createEngineEnVivoCore, parseState } from '@/lib/tools/adapters/envivo-engine-core';
import { fieldTargets, normalizeBroadcastMeta, validIngestUrl } from '@/lib/tools/envivo-platforms';
import { normalizeToolError } from '@/lib/tools/bff-core';
import { createHmac } from 'node:crypto';

test('"Duró {duracion}" reads naturally', () => {
  assert.equal(formatDuration(42), '42 s');
  assert.equal(formatDuration(12 * 60 + 20), '12 min');
  assert.equal(formatDuration(3600), '1 h');
  assert.equal(formatDuration(3600 + 5 * 60), '1 h 5 min');
});

test('the stream key is masked the same way whatever it is', () => {
  assert.equal(maskKey(), MASKED_KEY);
  assert.equal(MASKED_KEY, '••••••••');
});

test('"Mostrar" needs THIS session to be under 5 minutes old (or the password)', () => {
  const now = Date.parse('2026-10-03T10:00:00.000Z');
  const jwt = (claims: object) =>
    `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;
  const sec = (iso: string) => Date.parse(iso) / 1000;
  // amr (the session's sign-in timestamps) wins over iat, which moves on
  // every token refresh.
  const fresh = jwt({
    iat: sec('2026-10-03T09:59:00Z'),
    amr: [{ method: 'password', timestamp: sec('2026-10-03T09:57:00Z') }],
  });
  const refreshed = jwt({
    iat: sec('2026-10-03T09:59:30Z'),
    amr: [{ method: 'otp', timestamp: sec('2026-10-03T08:00:00Z') }],
  });
  assert.equal(recentSignIn(sessionAuthTimeMs(fresh), now), true);
  assert.equal(
    recentSignIn(sessionAuthTimeMs(refreshed), now),
    false,
    'a refreshed token is not a sign-in',
  );
  // No amr: no proof of a recent sign-in, whatever iat says.
  assert.equal(sessionAuthTimeMs(jwt({ iat: sec('2026-10-03T09:58:00Z') })), null);
  assert.equal(sessionAuthTimeMs('not-a-jwt'), null);
  assert.equal(sessionAuthTimeMs(null), null);
  assert.equal(recentSignIn(null, now), false);
  assert.equal(recentSignIn(now + 60_000, now), false, 'not from the future');
});

test('"Mostrar" password checks are rate limited per user', () => {
  assert.equal(REVEAL_MAX_ATTEMPTS, 5);
  assert.equal(REVEAL_WINDOW_MS, 15 * 60_000);
  assert.ok(revealAttemptAllowed(0));
  assert.ok(revealAttemptAllowed(4));
  assert.ok(!revealAttemptAllowed(5));
});

// ── The hub → engine credential ─────────────────────────────────────────
const SECRET = 'test-secret';
const WHO = { userId: 'u1', email: 'a@b.mx', tenantId: 't1', tier: 'vip' };

test('engine token: launch-token wire format, HMAC over the payload, aud + short exp', () => {
  const now = 1_800_000_000;
  const tok = mintEngineToken(WHO, API_AUD, SECRET, now);
  const [body, sig] = tok.split('.');
  assert.equal(sig, createHmac('sha256', SECRET).update(body!).digest('base64url'));
  const claims = JSON.parse(Buffer.from(body!, 'base64url').toString());
  assert.deepEqual(claims, {
    user_id: 'u1',
    email: 'a@b.mx',
    tenant_id: 't1',
    tier: 'vip',
    exp: now + 120,
    aud: API_AUD,
  });
  const prev = verifyEngineToken(
    mintEngineToken(WHO, PREVIEW_AUD, SECRET, now),
    PREVIEW_AUD,
    SECRET,
    now,
  );
  assert.equal(prev?.exp, now + 1800);
});

test('engine token: forged, expired, wrong audience and launch tokens are refused', () => {
  const now = 1_800_000_000;
  const prev = mintEngineToken(WHO, PREVIEW_AUD, SECRET, now);
  assert.ok(verifyEngineToken(prev, PREVIEW_AUD, SECRET, now));
  assert.equal(verifyEngineToken(prev, PREVIEW_AUD, 'other', now), null, 'other secret');
  assert.equal(verifyEngineToken(prev, API_AUD, SECRET, now), null, 'preview token on the API');
  assert.equal(verifyEngineToken(prev, PREVIEW_AUD, SECRET, now + 1801), null, 'expired');
  const [body] = prev.split('.');
  const tampered = Buffer.from(
    JSON.stringify({ ...JSON.parse(Buffer.from(body!, 'base64url').toString()), tenant_id: 't2' }),
  ).toString('base64url');
  assert.equal(
    verifyEngineToken(`${tampered}.${prev.split('.')[1]}`, PREVIEW_AUD, SECRET, now),
    null,
  );
  const launch = signEngineToken(
    { user_id: 'u1', email: 'a@b.mx', tenant_id: 't1', tier: 'vip', exp: now + 300 } as never,
    SECRET,
  );
  assert.equal(verifyEngineToken(launch, PREVIEW_AUD, SECRET, now), null, 'no aud = launch token');
  for (const junk of ['', '.', 'a.b.c', 'abc', `${body}.`])
    assert.equal(verifyEngineToken(junk, PREVIEW_AUD, SECRET, now), null, junk);
  assert.equal(verifyEngineToken(prev, PREVIEW_AUD, '', now), null, 'no secret configured');
});

test('preview path: simple segment names only', () => {
  assert.equal(safePreviewPath(['index.m3u8']), 'index.m3u8');
  assert.equal(safePreviewPath(['video1_stream.m3u8']), 'video1_stream.m3u8');
  for (const bad of [[], ['..'], ['.'], ['a', '..', 'b'], ['a/b'], ['%2e%2e'], ['a?b']])
    assert.equal(safePreviewPath(bad), null, bad.join('/'));
  assert.equal(previewUrlFor(null).url, null);
  assert.match(previewUrlFor('x.y').url!, /^\/api\/tools\/chalybobs\/preview\/x\.y\/index\.m3u8$/);
});

// ── BFF helpers ─────────────────────────────────────────────────────────
test('destination edits: only known fields, valid ingest schemes, empty key keeps the saved one', () => {
  assert.deepEqual(
    parseDestinationPatch({
      channelHandle: ' yo ',
      ingestUrl: 'rtmps://x/app',
      streamKey: '',
      enabled: true,
      tenant_id: 'evil',
    }),
    { channelHandle: 'yo', ingestUrl: 'rtmps://x/app' },
  );
  assert.deepEqual(parseDestinationPatch({ streamKey: ' k ' }), { streamKey: 'k' });
  for (const bad of [
    { ingestUrl: 'http://x' },
    { ingestUrl: 'file:///etc/passwd' },
    { streamKey: 7 },
    { channelHandle: 'x'.repeat(201) },
  ])
    assert.throws(() => parseDestinationPatch(bad), /./, JSON.stringify(bad));
  assert.equal(validIngestUrl(''), true);
  assert.equal(validIngestUrl('srt://h:1?streamid=a'), true);
  assert.throws(() => parseDestinationId('../x'));
  assert.equal(parseDestinationId('9b1c-ab_2'), '9b1c-ab_2');
});

test('OAuth: the pending cookie binds person, platform, state and expiry', () => {
  const now = 1_800_000_000;
  const p = newOAuthPending('u1', 'kick', now);
  assert.match(p.state, /^hub\.[A-Za-z0-9_-]{32}$/);
  assert.equal(pkceChallenge(p.verifier).length, 43);
  const back = decodePending(encodePending(p));
  assert.deepEqual(back, p);
  assert.ok(pendingMatches(back, { userId: 'u1', platform: 'kick', state: p.state }, now));
  assert.ok(
    !pendingMatches(back, { userId: 'u2', platform: 'kick', state: p.state }, now),
    'other person',
  );
  assert.ok(
    !pendingMatches(back, { userId: 'u1', platform: 'twitch', state: p.state }, now),
    'other platform',
  );
  assert.ok(
    !pendingMatches(back, { userId: 'u1', platform: 'kick', state: 'hub.x' }, now),
    'other state',
  );
  assert.ok(
    !pendingMatches(back, { userId: 'u1', platform: 'kick', state: null }, now),
    'no state',
  );
  assert.ok(!pendingMatches(back, { userId: 'u1', platform: 'kick' }, now + 601), 'expired');
  assert.equal(decodePending('garbage'), null);
  assert.equal(decodePending(Buffer.from('{"userId":"u1"}').toString('base64url')), null);
});

test('OAuth: the result goes back to Transmitir on this origin only', () => {
  const u = backToStudio({ error: 'kick_denied' }, 'https://www.chalyb.com/api/x');
  assert.equal(u.href, 'https://www.chalyb.com/app/en-vivo?connect_error=kick_denied');
  assert.equal(
    backToStudio({ connected: 'twitch' }, 'https://www.chalyb.com/').href,
    'https://www.chalyb.com/app/en-vivo?connected=twitch',
  );
});

test('composer: untrusted meta is normalized and capped; targets follow platform support', () => {
  const m = normalizeBroadcastMeta(
    { title: ' ', tags: ['a', 2, 'b'], visibility: 'secret', language: 'xx', madeForKids: 'yes' },
    'Fallback',
  );
  assert.equal(m.title, 'Fallback');
  assert.deepEqual(m.tags, ['a', 'b']);
  assert.equal(m.visibility, 'public');
  assert.equal(m.language, '');
  assert.equal(m.madeForKids, false);
  assert.equal(normalizeBroadcastMeta({ title: 'x'.repeat(500) }, '').title.length, 200);
  assert.deepEqual(fieldTargets('description', ['kick', 'youtube', 'facebook']), [
    'youtube',
    'facebook',
  ]);
  assert.deepEqual(fieldTargets('title', []), []);
});

// ── The real engine adapter, against a fake engine ─────────────────────
function fakeEngine(routes: Record<string, (body: unknown) => [number, unknown]>) {
  const calls: { url: string; method: string; auth: string; body: unknown }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({
      url: u,
      method,
      auth: String((init?.headers as Record<string, string>).Authorization),
      body,
    });
    const path = new URL(u).pathname.replace('/api/hub/v1', '');
    const h = routes[`${method} ${path}`];
    const [status, json] = h ? h(body) : [404, { error: 'not_found' }];
    return new Response(JSON.stringify(json), { status });
  }) as typeof fetch;
  const adapter = createEngineEnVivoCore({
    secret: () => SECRET,
    resolve: async (userId) => ({ base: 'https://obs.test/', who: { ...WHO, userId } }),
    fetchImpl,
  });
  return { adapter, calls };
}

test('engine adapter: every call carries a fresh API bearer for the person', async () => {
  const { adapter, calls } = fakeEngine({
    'GET /state': () => [200, { title: 'Hola', destinations: [] }],
    'PATCH /session': () => [200, { ok: true }],
  });
  await adapter.state('u1');
  await adapter.setTitle('u1', 'Nuevo');
  assert.equal(calls[0]!.url, 'https://obs.test/api/hub/v1/state');
  const tok = calls[0]!.auth.replace(/^Bearer /, '');
  const claims = verifyEngineToken(tok, API_AUD, SECRET);
  assert.equal(claims?.tenant_id, 't1');
  assert.equal(claims?.user_id, 'u1');
  assert.deepEqual(calls[1]!.body, { title: 'Nuevo' });
  const prev = await adapter.previewToken('u1');
  assert.ok(verifyEngineToken(prev!, PREVIEW_AUD, SECRET), 'preview token has its own aud');
});

test('engine adapter: /state is re-shaped and never carries a key or token', () => {
  const s = parseState({
    title: 'T',
    isLive: true,
    streamKey: 'chalyb_live_secret',
    rtmpUrl: 'rtmp://i/live',
    oauthAvailable: { kick: true, twitch: 'yes' },
    destinations: [
      {
        id: 'd1',
        platformId: 'kick',
        channelHandle: 'yo',
        streamKey: 'dest-secret',
        oauth_token: 'tok',
        hasStreamKey: true,
        enabled: true,
        status: { kind: 'expired' },
      },
      { id: 'd2', platformId: 'myspace' },
    ],
  });
  assert.equal(s.isLive, true);
  assert.deepEqual(s.oauthAvailable, { kick: true, twitch: false, youtube: false });
  assert.equal(s.destinations.length, 1, 'unknown platforms dropped');
  assert.deepEqual(s.destinations[0]!.status, { kind: 'expired' });
  const json = JSON.stringify(s);
  assert.ok(!json.includes('secret') && !json.includes('"tok"'), json);
});

test('engine adapter: refusals are the person state, failures are outages', async () => {
  const { adapter } = fakeEngine({
    'PATCH /session': () => [403, { error: 'full_access_required' }],
    'POST /destinations/zz/toggle': () => [409, { error: 'not_configured' }],
    'DELETE /destinations/other': () => [404, { error: 'not_found' }],
    'GET /streams': () => [500, { error: 'boom' }],
    'POST /oauth/youtube/authorize': () => [503, { error: 'youtube_not_configured' }],
    'POST /oauth/kick/authorize': () => [200, { url: 'javascript:alert(1)' }],
  });
  const reason = async (p: Promise<unknown>) => {
    try {
      await p;
      return 'ok';
    } catch (e) {
      return normalizeToolError(e).reason;
    }
  };
  assert.equal(await reason(adapter.setClipsEnabled('u1', true)), 'needs_plan');
  assert.equal(await reason(adapter.toggleDestination('u1', 'zz')), 'bad_request');
  assert.equal(await reason(adapter.removeDestination('u1', 'other')), 'not_found');
  assert.equal(await reason(adapter.streams('u1')), 'unknown');
  assert.equal(
    await reason(adapter.oauthAuthorizeUrl('u1', 'youtube', { state: 'hub.x' })),
    'bad_request',
  );
  assert.equal(
    await reason(adapter.oauthAuthorizeUrl('u1', 'kick', { state: 'hub.x' })),
    'unknown',
    'only an https consent page is followed',
  );
});

test('engine adapter: no secret configured is an outage, never an unsigned call', async () => {
  let called = false;
  const adapter = createEngineEnVivoCore({
    secret: () => null,
    resolve: async () => ({ base: 'https://obs.test', who: WHO }),
    fetchImpl: (async () => {
      called = true;
      return new Response('{}');
    }) as typeof fetch,
  });
  await assert.rejects(adapter.state('u1'));
  assert.equal(called, false);
  assert.equal(await adapter.previewToken('u1'), null);
});

// ── The mock (development and e2e) follows the engine's rules ─────────
test('mock: destinations need a URL and a key to go on; keys never in state', async () => {
  const a = createMockEnVivo();
  await a.addDestination('u', 'twitch');
  let s = await a.state('u');
  const d = s.destinations[0]!;
  assert.equal(d.ingestUrl, 'rtmp://live.twitch.tv/app');
  await assert.rejects(a.toggleDestination('u', d.id));
  await a.updateDestination('u', d.id, { streamKey: 'live_123' });
  assert.equal(await a.toggleDestination('u', d.id), true);
  s = await a.state('u');
  assert.equal(s.destinations[0]!.hasStreamKey, true);
  assert.ok(!JSON.stringify(s).includes('live_123'));
  assert.equal(await a.destinationKey('u', d.id), 'live_123');
  await assert.rejects(a.removeDestination('other', d.id), 'another person cannot touch it');
  const k1 = await a.streamKey('u');
  await a.regenerateKey('u');
  assert.notEqual(await a.streamKey('u'), k1);
  await a.publishBroadcast('u', { ...s.broadcastMeta, title: 'Nuevo' });
  assert.equal((await a.state('u')).destinations[0]!.streamTitle, 'Nuevo');
  await a.oauthComplete('u', 'kick', { code: 'mock-code' });
  assert.ok(
    (await a.state('u')).destinations.some((x) => x.platformId === 'kick' && x.oauthConnected),
  );
});
