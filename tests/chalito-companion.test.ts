import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activityFor,
  companionOrDefault,
  companionSettled,
  companionShown,
  loadLastCompanion,
  onboardingActivity,
  saveLastCompanion,
  storeLookShown,
  type LastCompanion,
} from '../src/lib/chalito/companion';
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

type State = Parameters<typeof companionShown>[0];
/** The characters drawn, in order, over every state from opening the screen to settled. */
const drawn = (states: State[]) => {
  const out: string[] = [];
  for (const st of states) {
    const s = companionShown(st);
    const id = s.kind === 'pending' ? null : s.kind === 'custom' ? 'custom' : s.id;
    if (id && out.at(-1) !== id) out.push(id);
  }
  return out;
};
/** Signing in from the hub: loading, signed out while the bridge signs in (this device's leftover
 * settings), signed in with the device's values still there, then the account's, then the card. */
const login = (o: { account: string; card: 'none' | 'custom'; last: LastCompanion | null }): State[] => {
  const { last } = o;
  return [
    { pick: null, status: 'loading', avatar: undefined, card: 'unknown', last: null },
    { pick: null, status: 'loading', avatar: undefined, card: 'unknown', last },
    { pick: null, status: 'signed_out', avatar: undefined, card: 'unknown', last },
    { pick: null, status: 'unpaired', avatar: undefined, card: 'unknown', last },
    { pick: null, status: 'unpaired', avatar: o.account, card: 'unknown', last },
    { pick: null, status: 'unpaired', avatar: o.account, card: o.card, last },
    { pick: null, status: 'ready', avatar: o.account, card: o.card, last },
  ];
};

test('from login to first paint, only the selected character is ever drawn', () => {
  // First visit on this browser: the stand-in, then the account's character, once.
  assert.deepEqual(drawn(login({ account: 'luna', card: 'none', last: null })), ['luna']);
  assert.deepEqual(drawn(login({ account: 'luna', card: 'custom', last: null })), ['custom']);
  // Returning: last visit's character straight away, and nothing else.
  const owner = 'u1';
  assert.deepEqual(
    drawn(login({ account: 'luna', card: 'none', last: { owner, kind: 'roster', id: 'luna' } })),
    ['luna'],
  );
  assert.deepEqual(
    drawn(login({ account: 'luna', card: 'custom', last: { owner, kind: 'custom' } })),
    ['custom'],
  );
  // Before the account is known it never falls back to Chalito.
  for (const st of login({ account: 'luna', card: 'none', last: null }).slice(0, 5))
    assert.equal(companionShown(st).kind, 'pending');
});

test('a pick made on screen shows at once; the account settles it only once it is known', () => {
  const st: State = { pick: 'bruno', status: 'loading', avatar: undefined, card: 'unknown', last: null };
  assert.deepEqual(companionShown(st), { kind: 'roster', id: 'bruno' });
  assert.equal(companionSettled(st), false);
  assert.equal(companionSettled({ ...st, status: 'ready', avatar: 'luna', card: 'none' }), true);
  // An account with no companion yet is Chalito, once that is known.
  assert.deepEqual(companionShown({ pick: null, status: 'ready', avatar: null, card: 'none', last: null }), {
    kind: 'roster',
    id: 'chalito',
  });
});

test('last look is per account, and storage that throws is harmless', () => {
  const m = new Map<string, string>();
  const s = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  saveLastCompanion({ owner: 'u1', kind: 'roster', id: 'luna' }, () => s);
  assert.deepEqual(loadLastCompanion('u1', () => s), { owner: 'u1', kind: 'roster', id: 'luna' });
  assert.equal(loadLastCompanion('u2', () => s), null, "another account's look is never shown");
  assert.equal(loadLastCompanion(undefined, () => s), null);
  m.set('chalito.companion.last', '{"owner":"u1","kind":"roster","id":"nobody"}');
  assert.equal(loadLastCompanion('u1', () => s), null);
  m.set('chalito.companion.last', '{oops');
  assert.equal(loadLastCompanion('u1', () => s), null);
  const blocked = () => {
    throw new Error('SecurityError');
  };
  assert.equal(loadLastCompanion('u1', blocked), null);
  assert.doesNotThrow(() => saveLastCompanion({ owner: 'u1', kind: 'custom' }, blocked));
});

test('the store preview never shows the roster art and then swaps to the custom card', () => {
  type S = Parameters<typeof storeLookShown>[0];
  const kinds = (states: S[]) => {
    const out: string[] = [];
    for (const st of states) {
      const s = storeLookShown(st);
      const k = s.kind === 'roster' ? s.id : s.kind;
      if (k !== 'pending' && out.at(-1) !== k) out.push(k);
    }
    return out;
  };
  const open = (card: 'none' | 'custom', last: LastCompanion | null): S[] => [
    { avatar: 'luna', card: 'unknown', last },
    { avatar: 'luna', card: 'unknown', last },
    { avatar: 'luna', card, last },
  ];
  // First visit: the stand-in until the card's answer, then one look.
  assert.deepEqual(kinds(open('custom', null)), ['custom']);
  assert.deepEqual(kinds(open('none', null)), ['luna']);
  assert.equal(storeLookShown({ avatar: 'luna', card: 'unknown', last: null }).kind, 'pending');
  // Last visit wore the custom card: wait for it, no roster art first.
  assert.deepEqual(kinds(open('custom', { owner: 'u1', kind: 'custom' })), ['custom']);
  // Last visit was a roster one: the account's own roster avatar at once (not the cached id).
  assert.deepEqual(kinds(open('none', { owner: 'u1', kind: 'roster', id: 'bruno' })), ['luna']);
});
