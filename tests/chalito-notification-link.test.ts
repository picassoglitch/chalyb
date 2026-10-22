import test from 'node:test';
import assert from 'node:assert/strict';
import { DeepLink } from '@chalito/protocol';
import { notificationTarget } from '@/lib/chalito/web/notification-link';

// Every deep link the protocol allows must open somewhere (it used to say "Aviso no encontrado"
// for the recovery and account alerts ("/") and for English accounts' credit alerts).
test('every protocol deep link maps under /app/chalito', () => {
  const cases: [string, string][] = [
    ['/a/apr_1', '/app/chalito/a/apr_1'],
    ['/m/m1', '/app/chalito/m/m1'],
    ['/r/r1', '/app/chalito/r/r1'],
    ['/s/s1', '/app/chalito/sesiones/s1'],
    ['/creditos', '/app/chalito/creditos'],
    ['/en/creditos', '/app/chalito/creditos'],
    ['/en/a/apr_1', '/app/chalito/a/apr_1'],
    ['/', '/app/chalito'],
    ['/en/', '/app/chalito'],
  ];
  for (const [link, want] of cases) {
    assert.ok(DeepLink.safeParse(link).success, link);
    assert.equal(notificationTarget(link, 'es'), want, link);
    assert.equal(notificationTarget(link, 'en'), `/en${want}`, link);
  }
});

test('anything else is refused', () => {
  for (const bad of ['//evil.com', 'https://evil.com', '/ajustes', '/a/../../x', '/inicio', '/en/en/creditos'])
    assert.equal(notificationTarget(bad, 'es'), null, bad);
});
