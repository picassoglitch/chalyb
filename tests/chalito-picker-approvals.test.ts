import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AdapterKind, ApprovalKind, ApprovalRequestBody, DeviceEvent, CommandRejectReason } from '@chalito/protocol';
import {
  START_ADAPTERS,
  adapterAvailability,
  adapterNameKey,
  adaptersFor,
  keepAdapter,
} from '@/lib/chalito/web/adapters';
import {
  computerControlInfo,
  isComputerControl,
  malformedComputerControl,
  needsStepUp,
} from '@/lib/chalito/web/computer-control';
import { indexConnections, type ProviderStatus } from '@/lib/chalito/web/connect';
import es from '../src/lib/chalito/messages/es.json' with { type: 'json' };
import en from '../src/lib/chalito/messages/en.json' with { type: 'json' };

const doc = (state: ProviderStatus['state']) => ({
  mode: 'signin',
  connected: state === 'connected',
  state,
  cli: { installed: state !== 'not_installed', version: '1.0.0' },
  error: null,
  at: 5,
});

test('protocol: grok/gemini adapters, computer_control approvals and computer.changed, as in chalito #29/#31', () => {
  assert.deepEqual(AdapterKind.options, ['claude-code', 'codex', 'acp', 'grok', 'gemini']);
  for (const k of ['tool', 'decision', 'computer_control', 'terminal', 'remote_view', 'remote_control', 'app_control']) assert.ok(ApprovalKind.options.includes(k as never), k);
  const body = {
    v: 1,
    aid: 'a1',
    requestId: 'r1',
    sid: 's1',
    deviceId: 'agent1',
    kind: 'computer_control',
    risk: 'HIGH',
    stepUpRequired: true,
    origin: 'local',
    createdAt: 1,
    expiresAt: 2,
    detailsHash: 'a'.repeat(64),
  };
  assert.ok(ApprovalRequestBody.safeParse(body).success);
  assert.ok(!ApprovalRequestBody.safeParse({ ...body, kind: 'computer' }).success);
  const ev = { v: 1, type: 'computer.changed', deviceId: 'agent1', enabled: true, activeSessions: 1, by: 'hotkey', t: 1 };
  assert.ok(DeviceEvent.safeParse(ev).success);
  assert.ok(!DeviceEvent.safeParse({ ...ev, activeSessions: -1 }).success);
  for (const r of ['blocked_by_policy', 'provider_busy', 'provider_failed']) assert.ok(CommandRejectReason.safeParse(r).success);
});

test('new session: Grok and Gemini only once that computer reports them connected', () => {
  const idx = indexConnections([
    { provider: 'xai', device_id: 'pc1', doc: doc('connected') },
    { provider: 'google', device_id: 'pc1', doc: doc('needs_auth') },
    { provider: 'google', device_id: 'pc2', doc: doc('connected') },
  ]);
  const on = (dev: string) =>
    Object.fromEntries(
      adaptersFor(idx, dev)
        .filter((o) => ['claude-code', 'codex', 'grok', 'gemini'].includes(o.adapter.appId))
        .map((o) => [o.adapter.kind, o.availability]),
    );
  assert.deepEqual(on('pc1'), { 'claude-code': 'ready', codex: 'ready', grok: 'ready', gemini: 'connect' });
  assert.deepEqual(on('pc2'), { 'claude-code': 'ready', codex: 'ready', grok: 'connect', gemini: 'ready' });
  // Every other session app (goose, opencode, qwen-code…) is offered too, by app id on the ACP adapter.
  const all = adaptersFor(idx, 'pc1');
  for (const id of ['goose', 'opencode', 'qwen-code', 'copilot-cli', 'cursor-cli', 'mistral-vibe']) {
    const o = all.find((x) => x.adapter.appId === id);
    assert.ok(o, id);
    assert.equal(o.adapter.kind, 'acp');
    assert.equal(o.availability, 'connect', `${id} needs a connected report first`);
  }
  // No report (or the read failed): disabled with the link to connect, never offered blind.
  assert.deepEqual(on('pc3'), { 'claude-code': 'ready', codex: 'ready', grok: 'connect', gemini: 'connect' });
  for (const state of ['installing', 'signing_in', 'error', 'blocked_by_policy', 'not_installed'] as const) {
    const grok = START_ADAPTERS.find((a) => a.appId === 'grok')!;
    assert.equal(adapterAvailability(grok, indexConnections([{ provider: 'xai', device_id: 'd', doc: doc(state) }]).d), 'connect');
  }
  // Switching computers drops a choice that isn't usable there.
  assert.equal(keepAdapter('grok', adaptersFor(idx, 'pc1')), 'grok');
  assert.equal(keepAdapter('grok', adaptersFor(idx, 'pc2')), 'claude-code');
  assert.equal(keepAdapter('gemini', adaptersFor(idx, 'pc2')), 'gemini');
});

test('adapter names come from integrations.* (both languages)', () => {
  assert.equal(adapterNameKey('grok'), 'xai.agent');
  assert.equal(adapterNameKey('gemini'), 'google.agent');
  assert.equal(adapterNameKey('claude-code'), 'anthropic.agent');
  assert.equal(adapterNameKey('acp'), null);
  assert.equal(adapterNameKey(undefined), null);
  for (const m of [es, en]) {
    for (const a of START_ADAPTERS.filter((x) => x.kind !== 'acp')) {
      const [p, k] = adapterNameKey(a.kind)!.split('.') as [string, string];
      assert.ok((m.integrations as unknown as Record<string, Record<string, string>>)[p]![k]);
    }
  }
  assert.equal(es.integrations.xai.agent, 'Grok Build');
  assert.equal(es.integrations.google.agent, 'Gemini CLI');
});

test('computer_control: always a passkey step-up, never approvable without HIGH + step-up', () => {
  const cc = { kind: 'computer_control', risk: 'HIGH', stepUpRequired: true, agentDeviceId: 'pc1' };
  assert.ok(isComputerControl(cc));
  assert.ok(needsStepUp(cc));
  assert.ok(needsStepUp({ ...cc, risk: 'LOW', stepUpRequired: false }));
  assert.ok(!malformedComputerControl(cc));
  assert.ok(malformedComputerControl({ ...cc, stepUpRequired: false }));
  assert.ok(malformedComputerControl({ ...cc, risk: 'MED' }));
  assert.ok(!malformedComputerControl({ ...cc, kind: 'tool', risk: 'LOW', stepUpRequired: false }));
  assert.ok(!needsStepUp({ ...cc, kind: 'tool', risk: 'MED', stepUpRequired: false }));
});

test('computer_control: names the computer, session and agent from what the agent sent', () => {
  const devices = [{ deviceId: 'pc1', name: 'Laptop de Aldo' }];
  assert.deepEqual(
    computerControlInfo({ agentDeviceId: 'pc1' }, { session: 'chalyb', adapter: 'codex', firstAction: 'screenshot' }, devices),
    { computer: 'Laptop de Aldo', session: 'chalyb', adapterKey: 'openai.agent' },
  );
  assert.deepEqual(computerControlInfo({ agentDeviceId: 'pcX' }, 'nope', devices), {
    computer: null,
    session: null,
    adapterKey: null,
  });
});

test('computer_control copy: screen, mouse and keyboard, the computer, how to stop it (es/en)', () => {
  for (const [m, words] of [
    [es, ['pantalla', 'mouse', 'teclado', 'Ctrl+Alt+Esc', 'botón']],
    [en, ['screen', 'mouse', 'keyboard', 'Ctrl+Alt+Esc', 'button']],
  ] as const) {
    const c = m.live.approval.computer;
    const s = m.live.stepUp.computer;
    const all = `${c.body} ${c.stop} ${s.body} ${s.stop}`;
    for (const w of words) assert.ok(all.includes(w), w);
    assert.ok(c.body.includes('{computer}') && s.body.includes('{computer}'));
  }
});

test('screens: computer_control gets its own card and confirm; nothing auto-approves', () => {
  const approvals = readFileSync('src/components/tools/chalito/Approvals.tsx', 'utf8');
  assert.match(approvals, /confirmStepUp\(a\.risk, \{ kind: "computer_control", computer \}\)/);
  assert.match(approvals, /disabled=\{busy \|\| needsPasskey \|\| mustExpand \|\| unverified \|\| ccBad\}/);
  // The only allow is the person's click.
  assert.equal(approvals.match(/decide\(true\)/g)?.length, 1);
  assert.match(approvals, /onClick=\{\(\) => void decide\(true\)\}/);
  const host = readFileSync('src/components/tools/chalito/StepUpHost.tsx', 'utf8');
  assert.match(host, /p\.kind === "computer_control"/);
  const ns = readFileSync('src/components/tools/chalito/NewSession.tsx', 'utf8');
  assert.match(ns, /disabled=\{waiting \|\| off\}/);
  assert.match(ns, /href="\/ajustes"/);
});
