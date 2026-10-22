import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentEvent, CommandBody, Origin, RouteRules, isSignedOrigin } from '@chalito/protocol';
import type { DeviceView, EventView } from '@chalito/client';
import {
  EMPTY_RULES,
  addRule,
  autoStart,
  canTransfer,
  computersOf,
  moveRule,
  removeRule,
  transferOf,
  transferTargets,
  visiblePath,
} from '@/lib/chalito/web/remote-control';
import es from '../src/lib/chalito/messages/es.json' with { type: 'json' };
import en from '../src/lib/chalito/messages/en.json' with { type: 'json' };

// ADR 0031 (chalito): the hub side of remote control.

const pc = (deviceId: string, over: Partial<DeviceView> = {}): DeviceView => ({
  deviceId,
  role: 'agent',
  kind: 'desktop',
  platform: 'linux',
  name: deviceId.toUpperCase(),
  revoked: false,
  online: true,
  lastSeenAt: null,
  devMode: { on: false, toggles: [], since: null },
  policyHash: null,
  lastEvent: null,
  setup: { adapters: ['claude-code', 'codex', 'gemini'], workspaces: 2, labels: ['chalito', 'taquito'] },
  rev: 1,
  ...over,
});

const ev = (meta: Record<string, unknown>, seq = 1): EventView => ({
  sid: 's1',
  eid: `e${seq}`,
  seq,
  t: seq,
  type: 'session.transferred',
  urgency: 'low',
  meta: { direction: 'out', ...meta },
  content: null,
  rev: seq,
});

test('protocol sync: transfer command, event, terminal origin and routing rules are vendored', () => {
  const body = {
    v: 1,
    cid: 'c1',
    uid: 'u1',
    targetDeviceId: 'pc1',
    origin: 'client:phone1',
    nonce: 'n'.repeat(22),
    issuedAt: 1,
    expiresAt: 2,
    payload: { type: 'session.transfer', sid: 's1', toDeviceId: 'pc2' },
  };
  assert.ok(CommandBody.safeParse(body).success);
  assert.ok(Origin.safeParse('local:cli').success);
  assert.equal(isSignedOrigin('local:cli'), false);
  const e = { v: 1, eid: 'e', sid: 's', deviceId: 'pc1', seq: 1, t: 1, type: 'session.transferred', direction: 'out', stage: 'refused', peerDeviceId: 'pc2', reason: 'no_link' };
  assert.ok(AgentEvent.safeParse(e).success);
  assert.ok(RouteRules.safeParse({ v: 1, rules: [{ workspaceLabel: 'chalito', devices: ['pc1'] }], fallback: [] }).success);
});

test('Automático: the rule picks computer and AI, and start carries the right target', () => {
  const rules = addRule(EMPTY_RULES, { workspaceLabel: 'chalito', appId: 'gemini', devices: ['home'] });
  const r = autoStart(rules, ' chalito ', [pc('home'), pc('office')]);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.choice.deviceId, 'home');
  assert.equal(r.choice.workspaceLabel, 'chalito');
  assert.deepEqual(r.target, { adapter: 'gemini' });
  const offline = autoStart(rules, 'chalito', [pc('home', { online: false }), pc('office')]);
  assert.ok(offline.ok && offline.choice.deviceId === 'office' && offline.choice.appId === 'claude-code');
  assert.deepEqual(autoStart(rules, 'otro', [pc('home')]), { ok: false });
  assert.deepEqual(autoStart(null, 'chalito', []), { ok: false });
});

test('rules edit as a list; computers list online first and drop phones and revoked ones', () => {
  let r = addRule(EMPTY_RULES, { devices: ['a'] });
  r = addRule(r, { appId: 'codex', devices: ['b'] });
  assert.deepEqual(moveRule(r, 1, -1).rules.map((x) => x.devices[0]), ['b', 'a']);
  assert.deepEqual(moveRule(r, 0, -1), r);
  assert.deepEqual(removeRule(r, 0).rules, [{ appId: 'codex', devices: ['b'] }]);
  const list = computersOf([pc('z'), pc('a', { online: false }), pc('p', { role: 'client' }), pc('r', { revoked: true })]);
  assert.deepEqual(list.map((d) => d.deviceId), ['z', 'a']);
  assert.deepEqual(transferTargets([pc('z'), pc('y')], 'z').map((d) => d.deviceId), ['y']);
});

test('transfer state comes from the newest outgoing session.transferred event', () => {
  assert.deepEqual(transferOf(undefined), { stage: 'none' });
  assert.deepEqual(transferOf([ev({ stage: 'sent', peerDeviceId: 'pc2' })]), { stage: 'sent', to: 'pc2', branch: null, files: [] });
  assert.deepEqual(transferOf([ev({ stage: 'sent', peerDeviceId: 'pc2', branch: 'chalito/move-0a1b2c3d' })]), {
    stage: 'sent',
    to: 'pc2',
    branch: 'chalito/move-0a1b2c3d',
    files: [],
  });
  assert.deepEqual(
    transferOf([ev({ stage: 'sent', peerDeviceId: 'pc2' }), ev({ stage: 'delivered', peerDeviceId: 'pc2', peerSid: 's9' }, 2)]),
    { stage: 'delivered', to: 'pc2', peerSid: 's9', branch: null, files: [] },
  );
  assert.deepEqual(transferOf([ev({ stage: 'refused', peerDeviceId: 'pc2', reason: 'dirty' })]), {
    stage: 'refused',
    to: 'pc2',
    reason: 'dirty',
    files: [],
  });
  // An incoming one (this session arrived here) isn't this session's own move.
  assert.deepEqual(transferOf([ev({ direction: 'in', stage: 'delivered', peerDeviceId: 'pc1' })]), { stage: 'none' });
  assert.equal(canTransfer('idle', { stage: 'none' }), true);
  assert.equal(canTransfer('running', { stage: 'none' }), false);
  assert.equal(canTransfer('idle', { stage: 'sent', to: 'x', branch: null, files: [] }), false);
});

test('copy: every transfer refusal has its text in es and en', () => {
  for (const reason of ['busy', 'no_link', 'dirty', 'unpushed', 'offline', 'wrong_repo', 'start_failed', 'link_refused', 'push_auth', 'push_failed', 'secret_files', 'git_too_old', 'lfs_files'])
    for (const m of [es, en])
      assert.equal(typeof (m.live.transfer.refused as Record<string, string>)[reason], 'string', reason);
  assert.equal(typeof es.routing.title, 'string');
  assert.equal(typeof en.live.newSession.auto, 'string');
});

test('a move shows the untracked files it took, and a refusal the files it refused on (sealed content)', () => {
  const sent = { ...ev({ stage: 'sent', peerDeviceId: 'pc2', branch: 'chalito/move-0a1b2c3d' }), content: { untracked: ['nuevo.ts'] } };
  const delivered = ev({ stage: 'delivered', peerDeviceId: 'pc2', peerSid: 's9' }, 2);
  assert.deepEqual(transferOf([sent, delivered]), {
    stage: 'delivered',
    to: 'pc2',
    peerSid: 's9',
    branch: null,
    files: ['nuevo.ts'],
  });
  const refused = { ...ev({ stage: 'refused', peerDeviceId: 'pc2', reason: 'secret_files' }), content: { secretFiles: ['.env', 7] } };
  assert.deepEqual(transferOf([refused]), { stage: 'refused', to: 'pc2', reason: 'secret_files', files: ['.env'] });
  // "dirty" no longer means "commit and push first" (work is saved on a branch); it names what still blocks.
  assert.ok(/remoto/.test(es.live.transfer.refused.dirty) && /remote/.test(en.live.transfer.refused.dirty));
});

test('file names show hidden and reordering characters as visible escapes', () => {
  assert.equal(visiblePath('src/a\u202Egnp.exe'), 'src/a\\u{202E}gnp.exe');
  assert.equal(visiblePath('zero\u200Bwidth\u2066x\u0007'), 'zero\\u{200B}width\\u{2066}x\\u{0007}');
  assert.equal(visiblePath('normal/ñandú.ts'), 'normal/ñandú.ts');
  const refused = { ...ev({ stage: 'refused', peerDeviceId: 'pc2', reason: 'secret_files' }), content: { secretFiles: ['\u202Etxt.env'] } };
  assert.deepEqual((transferOf([refused]) as { files: string[] }).files, ['\\u{202E}txt.env']);
});
