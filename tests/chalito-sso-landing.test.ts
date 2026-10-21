import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { NEXT_COOKIE_NAME, ssoLandingPath } from '../src/lib/chalito/web/sso-landing';
import { GET } from '../src/app/[locale]/(dashboard)/app/chalito/auth/sso/route';

// /auth/launch/chalito mints the token for external_url (www.chalyb.com/app/chalito since 0067)
// and 302s to <external_url>/auth/sso: that page has to exist (it was a 404 in production).
const hit = async (locale: string, cookie?: string) => {
  const req = new NextRequest('https://www.chalyb.com/app/chalito/auth/sso?token=SECRET&next=%2F', {
    headers: cookie ? { cookie } : {},
  });
  return GET(req, { params: Promise.resolve({ locale }) });
};

test('the landing redirects into Chalito, drops the token and clears the sign-in cookies', async () => {
  const res = await hit('en', `${NEXT_COOKIE_NAME}=${encodeURIComponent('/en/app/chalito/r/abc?q=a%20b')}; chalito_sso_state=x`);
  assert.equal(res.status, 307);
  const to = res.headers.get('location')!;
  assert.equal(new URL(to).pathname + new URL(to).search, '/en/app/chalito/r/abc?q=a%20b');
  assert.ok(!to.includes('SECRET'));
  assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
  const cleared = res.headers.getSetCookie().join('\n');
  assert.match(cleared, /chalito_next=;/);
  assert.match(cleared, /chalito_sso_state=;/);
  assert.equal(new URL((await hit('es')).headers.get('location')!).pathname, '/app/chalito');
  const evil = await hit('es', `${NEXT_COOKIE_NAME}=${encodeURIComponent('https://evil.com')}`);
  assert.equal(evil.headers.get('location'), 'https://www.chalyb.com/app/chalito');
});

test('lands on the Chalito page "Entrar con Chalyb" left from, or Inicio', () => {
  assert.equal(ssoLandingPath(undefined, 'es'), '/app/chalito');
  assert.equal(ssoLandingPath(undefined, 'en'), '/en/app/chalito');
  assert.equal(ssoLandingPath('/app/chalito/ajustes', 'es'), '/app/chalito/ajustes');
  assert.equal(ssoLandingPath('/app/chalito/r/abc?x=a%20b', 'es'), '/app/chalito/r/abc?x=a%20b');
});

test('never leaves Chalito, never loops back to itself, survives junk', () => {
  for (const bad of [
    'https://evil.com',
    '//evil.com',
    '/app/planes',
    '/api/tools/chalito/sso',
    '/app/chalito/auth/sso?token=x',
    '/en/app/chalito/auth/sso',
    '/app/chalitox',
    '/%2e//evil.com',
    '/app/chalito/\\evil',
  ])
    assert.equal(ssoLandingPath(bad, 'es'), '/app/chalito', bad);
});
