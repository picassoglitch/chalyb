// Engine calls carry the screen's language; Spanish stays byte-identical (no `lang`).
// Real adapters over real HTTP (global fetch) against a recording fake engine.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createEngineCaller, createEngineSenales } from '@/lib/tools/adapters/senales-engine';
import { createEngineEnVivoCore } from '@/lib/tools/adapters/envivo-engine-core';
import { loadSignalFeed } from '@/lib/tools/signals-feed';
import { engineLang } from '@/lib/tools/engine-lang';
import { engineLangQuery, refererLocale } from '@/lib/tools/routes';
import type { AppLocale } from '@/i18n/locales';
import type { SenalesAdapter, Signal } from '@/lib/tools/adapters/tools';

const ID = '3f2b8a7e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
const entry = (lang: string | null) => ({
  id: ID,
  coin: 'BTC',
  state: 'buy',
  confidence: 'medium',
  explanation: lang === 'en' ? '2 of 3 strategies agree.' : '2 de 3 estrategias coinciden.',
  at: '2026-11-07T05:00:00+00:00',
  why: { short: lang === 'en' ? 'Up.' : 'Arriba.', bullets: [] },
});

// ── fake engine over real HTTP ─────────────────────────────────────────
type Seen = { method: string; url: string; acceptLanguage: string | undefined };
const seen: Seen[] = [];
let server: Server;
let base = '';

function reply(req: IncomingMessage): [number, unknown] {
  const u = new URL(req.url ?? '/', 'http://x');
  const lang = u.searchParams.get('lang');
  const path = u.pathname.replace('/api/hub/v1', '');
  if (path === '/feed') return [200, { signals: [entry(lang)] }];
  if (path === `/feed/${ID}`) return [200, { signal: entry(lang), series: [] }];
  if (path === '/state')
    return [200, { title: lang === 'en' ? 'My live stream' : 'Mi transmisión en vivo' }];
  if (path.endsWith('/stream-key')) return [200, { streamKey: 'live_x' }];
  if (path === '/oauth/youtube/authorize') return [200, { url: 'https://accounts.test/x' }];
  if (path === '/streams') return [200, { streams: [] }];
  if (path.startsWith('/destinations/') && path.endsWith('/toggle'))
    return [200, { enabled: true }];
  return [200, { ok: true }];
}

before(async () => {
  process.env.CHALYBCRYPTO_SSO_SECRET = 'test-shared-sso-secret-must-be-long-enough-32b';
  server = createServer((req, res) => {
    seen.push({
      method: req.method ?? '',
      url: req.url ?? '',
      acceptLanguage: req.headers['accept-language'] as string | undefined,
    });
    req.resume();
    req.on('end', () => {
      const [status, body] = reply(req);
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => new Promise<void>((r) => server.close(() => r())));

const senales = (lang: AppLocale) =>
  createEngineSenales(
    createEngineCaller(async () => base),
    async () => lang,
  );
const envivo = (lang?: AppLocale) =>
  createEngineEnVivoCore({
    secret: () => 'test-secret',
    resolve: async (userId) => ({
      base,
      who: { userId, email: 'a@b.mx', tenantId: 't1', tier: 'vip' },
    }),
    ...(lang ? { lang: async () => lang } : {}),
  });
const since = () => seen.length;

// ── Señales feed ───────────────────────────────────────────────────────
test('feed: Spanish sends the same query as before (no lang); English adds lang=en', async () => {
  let n = since();
  const es = await senales('es').getSignals({ plan: 'PRO', since: '2026-11-01' });
  assert.equal(seen[n]!.url, '/api/hub/v1/feed?plan=PRO&since=2026-11-01');
  assert.equal(es[0]!.explanation, '2 de 3 estrategias coinciden.');

  n = since();
  const en = await senales('en').getSignals({ plan: 'PRO', since: '2026-11-01' });
  assert.equal(seen[n]!.url, '/api/hub/v1/feed?plan=PRO&since=2026-11-01&lang=en');
  assert.equal(en[0]!.explanation, '2 of 3 strategies agree.');
});

test('feed item: Spanish unchanged; English adds lang=en', async () => {
  let n = since();
  const es = await senales('es').getSignal({ plan: 'PRO', id: ID, range: '1m' });
  assert.equal(seen[n]!.url, `/api/hub/v1/feed/${ID}?range=1m`);
  assert.equal(es!.signal.why!.short, 'Arriba.');

  n = since();
  const en = await senales('en').getSignal({ plan: 'PRO', id: ID, range: '1m' });
  assert.equal(seen[n]!.url, `/api/hub/v1/feed/${ID}?range=1m&lang=en`);
  assert.equal(en!.signal.why!.short, 'Up.');
});

test('feed: per-user Señales calls (prefs, markets) never carry lang', async () => {
  const n = since();
  await senales('en').markets('u1', 'bitunix');
  assert.equal(seen[n]!.url, '/api/hub/v1/markets?venue=bitunix');
});

test('the default adapter outside a request is Spanish (no lang)', async () => {
  assert.equal(await engineLang(), 'es');
  const n = since();
  await createEngineSenales(createEngineCaller(async () => base)).getSignals({ plan: 'VIP' });
  assert.equal(seen[n]!.url, '/api/hub/v1/feed?plan=VIP');
});

// ── En vivo ────────────────────────────────────────────────────────────
async function everyCall(a: ReturnType<typeof envivo>) {
  await a.state('u1');
  await a.setTitle('u1', '');
  await a.setClipsEnabled('u1', true);
  await a.streamKey('u1');
  await a.regenerateKey('u1');
  await a.addDestination('u1', 'youtube');
  await a.updateDestination('u1', 'd1', { enabled: true } as never);
  await a.toggleDestination('u1', 'd1');
  await a.removeDestination('u1', 'd1');
  await a.destinationKey('u1', 'd1');
  await a.publishBroadcast('u1', { title: '' } as never);
  await a.streams('u1');
  await a.oauthAuthorizeUrl('u1', 'youtube', { redirectUri: 'https://x' } as never);
  await a.oauthComplete('u1', 'youtube', { code: 'c' } as never);
}

test('En vivo: English state (where sessions are created) asks for lang=en and gets the English title', async () => {
  const n = since();
  const st = await envivo('en').state('u1');
  assert.equal(seen[n]!.url, '/api/hub/v1/state?lang=en');
  assert.equal(st.title, 'My live stream');
});

test('En vivo: every engine call carries lang=en in English (any route can create the session)', async () => {
  const n = since();
  await everyCall(envivo('en'));
  const calls = seen.slice(n);
  assert.equal(calls.length, 14);
  for (const c of calls) assert.match(c.url, /^\/api\/hub\/v1\/[^?]+\?lang=en$/, c.url);
});

test('En vivo: Spanish (explicit or no lang source) sends the exact URLs as before', async () => {
  for (const a of [envivo('es'), envivo()]) {
    const n = since();
    await everyCall(a);
    const urls = seen.slice(n).map((c) => `${c.method} ${c.url}`);
    assert.deepEqual(urls, [
      'GET /api/hub/v1/state',
      'PATCH /api/hub/v1/session',
      'PATCH /api/hub/v1/session',
      'GET /api/hub/v1/stream-key',
      'POST /api/hub/v1/stream-key/regenerate',
      'POST /api/hub/v1/destinations',
      'PATCH /api/hub/v1/destinations/d1',
      'POST /api/hub/v1/destinations/d1/toggle',
      'DELETE /api/hub/v1/destinations/d1',
      'GET /api/hub/v1/destinations/d1/stream-key',
      'POST /api/hub/v1/broadcast',
      'GET /api/hub/v1/streams',
      'POST /api/hub/v1/oauth/youtube/authorize',
      'POST /api/hub/v1/oauth/youtube/complete',
    ]);
  }
});

// ── the stale-feed fallback is per language ────────────────────────────
test('the last-feed fallback never serves one language to the other', async () => {
  const sig = (explanation: string): Signal => ({
    id: ID,
    coin: 'BTC',
    state: 'buy',
    confidence: 'medium',
    explanation,
    at: '2026-11-07T05:00:00+00:00',
    why: { short: '', bullets: [] },
  });
  let fail = false;
  let text = 'Español';
  const adapter = {
    getSignals: async () => {
      if (fail) throw Object.assign(new Error('down'), { code: 'NOT_FOUND' });
      return [sig(text)];
    },
  } as unknown as SenalesAdapter;
  const plan = 'FREE' as const;
  const es = await loadSignalFeed(adapter, plan, 'u1', [], async () => 'es');
  assert.equal(es.ok && es.signals[0]!.explanation, 'Español');
  text = 'English';
  const en = await loadSignalFeed(adapter, plan, 'u1', [], async () => 'en');
  assert.equal(en.ok && en.signals[0]!.explanation, 'English');

  // Engine down: each language falls back to its own last feed.
  fail = true;
  const esStale = await loadSignalFeed(adapter, plan, 'u1', [], async () => 'es');
  const enStale = await loadSignalFeed(adapter, plan, 'u1', [], async () => 'en');
  assert.deepEqual(
    [esStale.ok && esStale.stale, esStale.ok && esStale.signals[0]!.explanation],
    [true, 'Español'],
  );
  assert.deepEqual(
    [enStale.ok && enStale.stale, enStale.ok && enStale.signals[0]!.explanation],
    [true, 'English'],
  );
});

// ── pure helpers ───────────────────────────────────────────────────────
test('engineLangQuery: only English adds a param', () => {
  assert.deepEqual(engineLangQuery('es'), {});
  assert.deepEqual(engineLangQuery('en'), { lang: 'en' });
});

test('refererLocale: the calling hub page decides, same host only', () => {
  const host = 'www.chalyb.com';
  assert.equal(refererLocale('https://www.chalyb.com/en/app/en-vivo', host), 'en');
  assert.equal(refererLocale('https://www.chalyb.com/en', host), 'en');
  assert.equal(refererLocale('https://www.chalyb.com/app/en-vivo', host), 'es');
  assert.equal(refererLocale('https://www.chalyb.com/es/app', host), 'es');
  assert.equal(refererLocale('https://www.chalyb.com/english/app', host), 'es');
  assert.equal(refererLocale('https://www.chalyb.com/', host), 'es');
  assert.equal(refererLocale('https://evil.test/en/app', host), null);
  assert.equal(refererLocale('http://localhost:3000/en/app', 'localhost:3000'), 'en');
  assert.equal(refererLocale('not a url', host), null);
  assert.equal(refererLocale(null, host), null);
  assert.equal(refererLocale('https://www.chalyb.com/en/app', null), null);
});
