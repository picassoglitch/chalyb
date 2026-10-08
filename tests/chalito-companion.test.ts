import test from 'node:test';
import assert from 'node:assert/strict';
import { activityFor, companionOrDefault, homeHeroShown, onboardingActivity } from '../src/lib/chalito/companion';
import es from '../src/lib/chalito/messages/es.json' with { type: 'json' };
import en from '../src/lib/chalito/messages/en.json' with { type: 'json' };

test('the companion is the pick, or Chalito until there is one', () => {
  assert.equal(companionOrDefault('luna'), 'luna');
  assert.equal(companionOrDefault(null), 'chalito');
  assert.equal(companionOrDefault('nobody'), 'chalito');
});

test('each Chalito screen gives the companion something to do, with a line in es and en', () => {
  const paths = ['/', '/bandeja', '/sesiones', '/sesiones/nueva', '/dispositivos', '/salas', '/m/1',
    '/tienda', '/creditos', '/uso', '/conexiones', '/ajustes', '/descargar', '/a/1', '/n/1', '/otra'];
  const keys = new Set(paths.map((p) => activityFor(p).key));
  assert.ok(keys.size >= 14, 'screens should differ');
  assert.equal(activityFor('/sesiones/nueva').key, 'newSession');
  // Owner decision 2026-10-08: no per-screen props; it wears only what the person put on.
  for (const p of paths) assert.ok(!('cosmetic' in activityFor(p)), `no prop on ${p}`);
  const steps = ['signIn', 'companion', 'name', 'connect', 'billing', 'phone', 'pair', 'passkey'];
  const all = [...paths.map(activityFor), ...steps.flatMap((s) => [onboardingActivity(s, true), onboardingActivity(s, false)])];
  assert.equal(onboardingActivity('signIn', true).key, 'signedIn');
  for (const a of all) {
    assert.ok((es.companion.do as Record<string, string>)[a.key], `es ${a.key}`);
    assert.ok((en.companion.do as Record<string, string>)[a.key], `en ${a.key}`);
  }
});

test('Inicio shows exactly one companion: the hero, or the floating one when the hero is off', () => {
  // Owner decision 2026-10-05: every screen shows the picked companion. Signed out after
  // onboarding there is no hero, so the floating one must stay (it used to hide on `onboarded`).
  assert.equal(homeHeroShown({ settingsLoaded: true, onboarded: true, sessionStatus: 'signed_in' }), true);
  assert.equal(homeHeroShown({ settingsLoaded: true, onboarded: true, sessionStatus: 'signed_out' }), false);
  assert.equal(homeHeroShown({ settingsLoaded: false, onboarded: true, sessionStatus: 'signed_in' }), false);
  assert.equal(homeHeroShown({ settingsLoaded: true, onboarded: false, sessionStatus: 'loading' }), false);
});
