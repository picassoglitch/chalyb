import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { NEXT_COOKIE_NAME, ssoLandingPath } from '../src/lib/chalito/web/sso-landing';

// /auth/launch/chalito mints the token for external_url (www.chalyb.com/app/chalito since 0067)
// and 302s to <external_url>/auth/sso: that page has to exist (it was a 404 in production).
test('the launch landing /app/chalito/auth/sso exists', () => {
  assert.ok(existsSync('src/app/[locale]/(dashboard)/app/chalito/auth/sso/route.ts'));
});

test('lands on the Chalito page "Entrar con Chalyb" left from, or Inicio', () => {
  assert.equal(ssoLandingPath(undefined, 'es'), '/app/chalito');
  assert.equal(ssoLandingPath(undefined, 'en'), '/en/app/chalito');
  assert.equal(ssoLandingPath(encodeURIComponent('/app/chalito/ajustes'), 'es'), '/app/chalito/ajustes');
  assert.equal(ssoLandingPath(encodeURIComponent('/en/app/chalito/r/abc?x=1'), 'en'), '/en/app/chalito/r/abc?x=1');
  assert.equal(NEXT_COOKIE_NAME, 'chalito_next');
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
    '%E0%A4%A',
    '/%2e//evil.com',
  ])
    assert.equal(ssoLandingPath(bad.startsWith('%') ? bad : encodeURIComponent(bad), 'es'), '/app/chalito', bad);
});
