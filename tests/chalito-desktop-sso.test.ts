import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { safeNextPath } from '@/lib/auth/safe-next';
import {
  DESKTOP_START_PATH,
  desktopHandoff,
  desktopStartPath,
  handoffFromQuery,
} from '@/lib/chalito/web/desktop-sso';

const STATE = 'A'.repeat(43);
const H = { state: STATE, redirect: 'chalito://auth/sso' };

const respond =
  (status: number, body?: unknown, calls: [string, RequestInit | undefined][] = []): typeof fetch =>
  (async (url: string | URL, init?: RequestInit) => {
    calls.push([String(url), init]);
    return new Response(body === undefined ? null : JSON.stringify(body), { status });
  }) as typeof fetch;

test('desktop sign-in: the desktop query is validated (state + chalito:// or loopback redirect only)', () => {
  assert.deepEqual(handoffFromQuery({ state: STATE, redirect_uri: 'chalito://auth/sso' }), H);
  assert.deepEqual(
    handoffFromQuery({ state: STATE, redirect_uri: 'http://127.0.0.1:43123/auth/sso' })?.redirect,
    'http://127.0.0.1:43123/auth/sso',
  );
  assert.equal(handoffFromQuery({ state: STATE, redirect_uri: 'https://evil.example/auth/sso' }), null);
  assert.equal(handoffFromQuery({ state: STATE, redirect_uri: 'http://127.0.0.1:80/auth/sso' }), null);
  assert.equal(handoffFromQuery({ state: 'short', redirect_uri: 'chalito://auth/sso' }), null);
  assert.equal(handoffFromQuery({ state: [STATE], redirect_uri: 'chalito://auth/sso' }), null);
  assert.equal(handoffFromQuery({}), null);
});

test('desktop sign-in, signed out: the sign-in `next` is this page with the same query, and it survives the round trip', () => {
  const next = desktopStartPath(H);
  assert.ok(next.startsWith(`${DESKTOP_START_PATH}?`));
  // What sign-in and /auth/callback accept back from /sign-in?next=… (the /app gate's next).
  assert.ok(!next.includes('\\') && !next.startsWith('//'));
  assert.equal(safeNextPath(next, '/account'), next);
  // Back on the page, the same handoff comes out of the query.
  const q = Object.fromEntries(new URL(next, 'https://www.chalyb.com').searchParams);
  assert.deepEqual(handoffFromQuery(q), H);
});

test('desktop sign-in, signed out: the page itself sends the person to hub sign-in with that next', () => {
  const page = readFileSync(
    join(import.meta.dirname, '../src/app/[locale]/(dashboard)/app/chalito/auth/desktop/page.tsx'),
    'utf8',
  );
  assert.match(page, /await requireUser\(desktopStartPath\(handoff\)\)/);
  // The /app layout gates it too (the proxy stamps the real path + query as `next`).
  const layout = readFileSync(join(import.meta.dirname, '../src/app/[locale]/(dashboard)/app/layout.tsx'), 'utf8');
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
  assert.deepEqual(await desktopHandoff(H, respond(401, { ok: false })), { ok: false, reason: 'signed_out' });
  assert.deepEqual(await desktopHandoff(H, respond(403, { ok: false })), { ok: false, reason: 'no_access' });
  assert.deepEqual(await desktopHandoff(H, respond(429)), { ok: false, reason: 'rate_limited' });
  assert.deepEqual(await desktopHandoff(H, respond(200, { ok: true })), { ok: false, reason: 'failed' });
  const offline = (async () => {
    throw new Error('offline');
  }) as unknown as typeof fetch;
  assert.deepEqual(await desktopHandoff(H, offline), { ok: false, reason: 'failed' });
});
