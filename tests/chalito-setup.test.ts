import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { DeviceView } from '@chalito/client';
import { DevicePresence, DeviceSetup } from '@chalito/protocol';
import { setupChecklist } from '@chalito/ui/setup';
import {
  computersOf,
  firstTaskTarget,
  setupInput,
  setupState,
  type SetupSources,
} from '@/lib/chalito/web/setup';

// First Run D (ADR 0028 §6): the setup checklist reads only real state; the first task runs
// in a folder the computer reported, by label, never by path.

const device = (over: Partial<DeviceView> & Pick<DeviceView, 'deviceId'>): DeviceView => ({
  role: 'agent',
  kind: 'laptop',
  platform: 'macos',
  name: over.deviceId,
  revoked: false,
  online: true,
  lastSeenAt: 1,
  devMode: { on: false, toggles: [], since: null },
  policyHash: null,
  lastEvent: null,
  setup: null,
  rev: 1,
  ...over,
});

const sources = (over: Partial<SetupSources> = {}): SetupSources => ({
  status: 'ready',
  signedIn: true,
  needsRecovery: false,
  devices: [],
  sessions: [],
  ...over,
});

const done = (s: SetupSources) =>
  setupState(s)
    .steps.filter((x) => x.done)
    .map((x) => x.id);

test('a new account: signed in, nothing else; the next step is approving this browser', () => {
  const s = setupState(sources({ status: 'unpaired' }));
  assert.deepEqual(done(sources({ status: 'unpaired' })), ['account']);
  assert.equal(s.current, 'browser');
  assert.equal(s.complete, false);
});

test('signed out: nothing is done', () => {
  assert.equal(setupState(sources({ status: 'signed_out', signedIn: false })).doneCount, 0);
});

test('a paired computer that reported nothing yet: next is an AI', () => {
  const s = setupState(sources({ devices: [device({ deviceId: 'pc' })] }));
  assert.equal(s.current, 'ai');
});

test('phones and revoked computers are not computers', () => {
  const devices = [
    device({ deviceId: 'phone', role: 'client' }),
    device({
      deviceId: 'old',
      revoked: true,
      setup: { adapters: ['claude-code'], workspaces: 1, labels: ['w'] },
    }),
  ];
  assert.deepEqual(computersOf(devices), []);
  assert.equal(setupState(sources({ devices })).current, 'computer');
});

test('only apps that run sessions count as "an AI ready"', () => {
  const pc = device({
    deviceId: 'pc',
    setup: { adapters: ['cursor', 'not-an-agent'], workspaces: 0, labels: [] },
  });
  assert.deepEqual(setupInput(sources({ devices: [pc] })).computers, [
    { adapters: [], workspaces: 0 },
  ]);
  const pc2 = device({
    deviceId: 'pc',
    setup: { adapters: ['claude-code'], workspaces: 2, labels: ['web', 'api'] },
  });
  const s = setupState(sources({ devices: [pc2] }));
  assert.equal(s.current, 'firstTask');
});

test('the directory hint counts as a computer before this browser is approved', () => {
  assert.ok(
    setupState(sources({ status: 'unpaired', needsRecovery: true })).steps.find(
      (x) => x.id === 'computer',
    )!.done,
  );
});

test('a session run completes it (also for an agent too old to report its setup)', () => {
  const s = setupState(
    sources({ devices: [device({ deviceId: 'pc' })], sessions: [{ sid: 's1' }] }),
  );
  assert.equal(s.complete, true);
  assert.equal(s.current, null);
});

test('the hub and the desktop share one derivation', () => {
  assert.deepEqual(
    setupState(sources()),
    setupChecklist({
      signedIn: true,
      deviceReady: true,
      computers: [],
      computerHint: false,
      sessions: 0,
    }),
  );
});

test('first task: an online computer with an app and a folder, the preferred app first', () => {
  const offline = device({
    deviceId: 'a',
    online: false,
    setup: { adapters: ['claude-code'], workspaces: 1, labels: ['old'] },
  });
  const online = device({
    deviceId: 'b',
    setup: { adapters: ['gemini', 'codex', 'claude-code'], workspaces: 2, labels: ['web', 'api'] },
  });
  assert.deepEqual(firstTaskTarget([offline, online]), {
    agentDeviceId: 'b',
    appId: 'claude-code',
    workspaceLabel: 'web',
  });
  assert.equal(
    firstTaskTarget([
      device({ deviceId: 'c', setup: { adapters: ['claude-code'], workspaces: 0, labels: [] } }),
    ]),
    null,
  );
  assert.equal(
    firstTaskTarget([
      device({ deviceId: 'd', setup: { adapters: [], workspaces: 1, labels: ['w'] } }),
    ]),
    null,
  );
});

test('the presence schema keeps paths out: labels only, strict', () => {
  assert.equal(
    DeviceSetup.safeParse({ adapters: [], workspaces: 1, labels: ['/Users/x/secret'] }).success,
    false,
  );
  assert.equal(
    DeviceSetup.safeParse({ adapters: [], workspaces: 1, labels: ['C:proj'] }).success,
    false,
  );
  assert.equal(DevicePresence.safeParse({ desktopActive: true, path: '/x' }).success, false);
  assert.equal(
    DeviceSetup.safeParse({ adapters: ['claude-code'], workspaces: 1, labels: ['web'] }).success,
    true,
  );
});

const es = JSON.parse(
  readFileSync(new URL('../src/lib/chalito/messages/es.json', import.meta.url), 'utf8'),
);
const en = JSON.parse(
  readFileSync(new URL('../src/lib/chalito/messages/en.json', import.meta.url), 'utf8'),
);

const keys = (o: unknown, p = ''): string[] =>
  o && typeof o === 'object'
    ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => keys(v, p ? `${p}.${k}` : k))
    : [p];

test('setup copy: every step has a title and a hint, in es and en, with the same keys', () => {
  for (const cat of [es, en])
    for (const id of ['account', 'browser', 'computer', 'ai', 'folder', 'firstTask']) {
      assert.equal(typeof cat.setup.step[id], 'string', id);
      assert.equal(typeof cat.setup.hint[id], 'string', id);
    }
  assert.deepEqual(keys(es.setup).sort(), keys(en.setup).sort());
  assert.deepEqual(keys(es).sort(), keys(en).sort());
});

/** Every string value (not the keys, which keep their code names). */
const values = (o: unknown): string[] =>
  o && typeof o === 'object'
    ? Object.values(o as Record<string, unknown>).flatMap(values)
    : [String(o)];

test('plain language (ADR 0028 §6): no glyph, ring, fingerprint-as-code or "trusted client" jargon left in Spanish', () => {
  const text = values(es).join('\n');
  assert.doesNotMatch(text, /glifo|anillo|cliente de confianza|de confianza/);
  assert.doesNotMatch(text, /\bpasskey\b/);
  assert.doesNotMatch(text, /Huella de este|la huella sea|esta huella/);
  assert.doesNotMatch(
    values(en).join('\n'),
    /\bglyph\b|\bring\b to scan|scan (this|its) ring|trusted device/,
  );
});
