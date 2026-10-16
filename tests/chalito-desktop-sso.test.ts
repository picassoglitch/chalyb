import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { safeNextPath } from '@/lib/auth/safe-next';
import {
  DESKTOP_PAGE_HEADERS,
  DESKTOP_START_PATH,
  desktopHandoff,
  desktopStartPath,
  handoffFromQuery,
  loopbackAllowed,
  validDesktopRedirect,
} from '@/lib/chalito/web/desktop-sso';

const STATE = 'A'.repeat(43);
const H = { state: STATE, redirect: 'chalito://auth/sso' };

const respond = (
  status: number,
  body?: unknown,
  calls: [string, RequestInit | undefined][] = [],
): typeof fetch =>
  (async (url: string | URL, init?: RequestInit) => {
    calls.push([String(url), init]);
    return new Response(body === undefined ? null : JSON.stringify(body), { status });
  }) as typeof fetch;

test('desktop sign-in: the desktop query is validated (state + exactly chalito://auth/sso)', () => {
  assert.deepEqual(
    handoffFromQuery({ state: STATE, redirect_uri: 'chalito://auth/sso' }, false),
    H,
  );
  assert.equal(
    handoffFromQuery({ state: STATE, redirect_uri: 'https://evil.example/auth/sso' }, true),
    null,
  );
  assert.equal(
    handoffFromQuery({ state: 'short', redirect_uri: 'chalito://auth/sso' }, true),
    null,
  );
  assert.equal(
    handoffFromQuery({ state: [STATE], redirect_uri: 'chalito://auth/sso' }, true),
    null,
  );
  assert.equal(handoffFromQuery({}, true), null);
});

test('desktop sign-in: near-miss redirects are refused', () => {
  for (const r of [
    'chalito://auth/sso?x=1',
    'chalito://auth/sso#x',
    'chalito://auth/sso/',
    'chalito://auth/sso/../x',
    'chalito://evil',
    'chalito://auth/ssox',
    'CHALITO://auth/sso',
    'Chalito://auth/sso',
    'chalito://AUTH/sso',
    ' chalito://auth/sso',
    'chalito:/auth/sso',
    'chalito://auth%2Fsso',
    'http://127.0.0.1:43123/auth/sso?x=1',
    'http://127.0.0.1:43123/auth/sso/../x',
    'http://localhost:43123/auth/sso',
    'https://127.0.0.1:43123/auth/sso',
    'http://127.0.0.1:1023/auth/sso',
    'http://127.0.0.1:65536/auth/sso',
  ])
    assert.equal(validDesktopRedirect(r, true), null, r);
});

test('desktop sign-in: the loopback redirect (tauri dev) works in dev and previews, never in production', () => {
  const loop = 'http://127.0.0.1:43123/auth/sso';
  assert.equal(validDesktopRedirect(loop, true), loop);
  assert.equal(validDesktopRedirect(loop, false), null);
  assert.equal(validDesktopRedirect('chalito://auth/sso', false), 'chalito://auth/sso');

  assert.equal(loopbackAllowed({ NODE_ENV: 'development' }), true);
  assert.equal(loopbackAllowed({ NODE_ENV: 'production', VERCEL_ENV: 'preview' }), true);
  assert.equal(loopbackAllowed({ NODE_ENV: 'production', VERCEL_ENV: 'production' }), false);
  assert.equal(loopbackAllowed({ NODE_ENV: 'development', VERCEL_ENV: 'production' }), false);
  // A production build anywhere else (self-hosted, `next start`) refuses it too.
  assert.equal(loopbackAllowed({ NODE_ENV: 'production' }), false);
  assert.equal(loopbackAllowed({}), false);
  assert.equal(handoffFromQuery({ state: STATE, redirect_uri: loop }, false), null);
});

test('desktop sign-in page: no-referrer, noindex and no-store (its URL carries the state)', async () => {
  const want = {
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow',
    'Cache-Control': 'no-store',
  };
  assert.deepEqual(Object.fromEntries(DESKTOP_PAGE_HEADERS.map((h) => [h.key, h.value])), want);
  const config = (await import('../next.config')).default as {
    headers: () => Promise<{ source: string; headers: { key: string; value: string }[] }[]>;
  };
  const rules = await config.headers();
  for (const source of [DESKTOP_START_PATH, `/:locale(en|es)${DESKTOP_START_PATH}`]) {
    const rule = rules.find((r) => r.source === source);
    assert.ok(rule, `no headers rule for ${source}`);
    assert.deepEqual(Object.fromEntries(rule.headers.map((h) => [h.key, h.value])), want);
  }
});

test('desktop sign-in, signed out: the sign-in `next` is this page with the same query, and it survives the round trip', () => {
  const next = desktopStartPath(H);
  assert.ok(next.startsWith(`${DESKTOP_START_PATH}?`));
  // What sign-in and /auth/callback accept back from /sign-in?next=… (the /app gate's next).
  assert.ok(!next.includes('\\') && !next.startsWith('//'));
  assert.equal(safeNextPath(next, '/account'), next);
  // Back on the page, the same handoff comes out of the query.
  const q = Object.fromEntries(new URL(next, 'https://www.chalyb.com').searchParams);
  assert.deepEqual(handoffFromQuery(q, false), H);
});

test('desktop sign-in, signed out: the page itself sends the person to hub sign-in with that next', () => {
  const page = readFileSync(
    join(import.meta.dirname, '../src/app/[locale]/(dashboard)/app/chalito/auth/desktop/page.tsx'),
    'utf8',
  );
  assert.match(page, /await requireUser\(desktopStartPath\(handoff\)\)/);
  // The /app layout gates it too (the proxy stamps the real path + query as `next`).
  const layout = readFileSync(
    join(import.meta.dirname, '../src/app/[locale]/(dashboard)/app/layout.tsx'),
    'utf8',
  );
  assert.match(layout, /requireUser\(/);
  assert.equal(DESKTOP_START_PATH, '/app/chalito/auth/desktop');
});

test('desktop sign-in, signed in: one launch token, handed to the app link; never exchanged here', async () => {
  const calls: [string, RequestInit | undefined][] = [];
  const r = await desktopHandoff(H, respond(200, { ok: true, token: 'tok-1' }, calls));
  assert.equal(calls.length, 1);
  assert.equal(calls[0]![0], '/api/tools/chalito/sso');
  assert.equal(calls[0]![1]?.method, 'POST');
  assert.ok(r.ok);
  const u = new URL(r.url);
  assert.equal(`${u.protocol}//${u.host}${u.pathname}`, 'chalito://auth/sso');
  assert.equal(u.searchParams.get('token'), 'tok-1');
  assert.equal(u.searchParams.get('state'), STATE);
});

test('desktop sign-in: hub refusals map to clear states', async () => {
  assert.deepEqual(await desktopHandoff(H, respond(401, { ok: false })), {
    ok: false,
    reason: 'signed_out',
  });
  assert.deepEqual(await desktopHandoff(H, respond(403, { ok: false })), {
    ok: false,
    reason: 'no_access',
  });
  assert.deepEqual(await desktopHandoff(H, respond(429)), { ok: false, reason: 'rate_limited' });
  assert.deepEqual(await desktopHandoff(H, respond(200, { ok: true })), {
    ok: false,
    reason: 'failed',
  });
  const offline = (async () => {
    throw new Error('offline');
  }) as unknown as typeof fetch;
  assert.deepEqual(await desktopHandoff(H, offline), { ok: false, reason: 'failed' });
});
