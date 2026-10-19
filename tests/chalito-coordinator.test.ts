import test from 'node:test';
import assert from 'node:assert/strict';
import { CommandBody, CommandRejectReason, CoordPlanState, SigningContext } from '@chalito/protocol';
import type { ApprovalView, DeviceView, SessionView } from '@chalito/client';
import {
  goalComputers,
  goalProblem,
  isCoordOrigin,
  planActions,
  planProgress,
  plansOf,
  popupApproval,
  rememberable,
} from '@/lib/chalito/web/coord';
import es from '../src/lib/chalito/messages/es.json' with { type: 'json' };
import en from '../src/lib/chalito/messages/en.json' with { type: 'json' };

const plan = (over: Partial<CoordPlanState> = {}): CoordPlanState => ({
  v: 1,
  planId: 'pabcdefgh',
  goal: 'add billing',
  workspaceLabel: 'taquito',
  base: 'main',
  status: 'awaiting_approval',
  maxAgents: 3,
  maxMinutes: 120,
  startedAt: null,
  tasks: [
    { id: 'api', title: 'API', acceptance: ['ok'], dependsOn: [], status: 'pending', branch: 'coord/pabcdefgh/api', sid: null, note: null, reviewRounds: 0 },
    { id: 'ui', title: 'UI', acceptance: ['ok'], dependsOn: ['api'], status: 'pending', branch: 'coord/pabcdefgh/ui', sid: null, note: null, reviewRounds: 0 },
  ],
  integration: { branch: 'coord/pabcdefgh/integration', sid: null, note: null, head: null },
  note: null,
  updatedAt: 5,
  ...over,
});

const device = (over: Partial<DeviceView>): DeviceView => ({
  deviceId: 'pc1',
  role: 'agent',
  kind: 'desktop',
  platform: 'linux',
  name: 'Linux',
  revoked: false,
  online: true,
  lastSeenAt: null,
  devMode: { on: false, toggles: [], since: null },
  policyHash: null,
  lastEvent: null,
  setup: null,
  rev: 1,
  ...over,
});

const approval = (over: Partial<ApprovalView> = {}): ApprovalView =>
  ({
    aid: 'a1',
    sid: 's1',
    agentDeviceId: 'pc1',
    requestId: 'r1',
    kind: 'tool',
    risk: 'MED',
    origin: 'agent:coord_pabcdefgh',
    stepUpRequired: false,
    status: 'pending',
    reason: null,
    createdAt: 1,
    expiresAt: 10_000,
    rev: 1,
    verified: true,
    detailsHash: 'a'.repeat(64),
    details: { toolName: 'Bash', input: { command: 'pnpm format' }, workspaceLabel: 'taquito' },
    ...over,
  }) as ApprovalView;

const session = (over: Partial<SessionView> = {}): SessionView => ({
  sid: 's1',
  agentDeviceId: 'pc1',
  updatedAt: 1,
  card: null,
  coord: null,
  rev: 1,
  ...over,
});

test('vendored protocol: coord commands, contexts and reasons as in chalito #73/#75', () => {
  for (const c of ['chalito.coordrule.v1', 'chalito.coordrule-revoke.v1', 'chalito.coordplan.v1']) assert.ok(SigningContext.options.includes(c as never), c);
  for (const r of ['coordinator_off', 'plan_not_waiting', 'plan_not_ready', 'base_moved', 'plan_changed']) assert.ok(CommandRejectReason.safeParse(r).success, r);
  const body = {
    v: 1,
    cid: 'c1',
    uid: 'u1',
    targetDeviceId: 'pc1',
    origin: 'client:dev_p',
    nonce: 'A'.repeat(22),
    issuedAt: 1,
    expiresAt: 2,
    payload: { type: 'coord.approve', planId: 'pabcdefgh', digest: 'a'.repeat(64) },
  };
  assert.ok(CommandBody.safeParse(body).success);
  assert.ok(!CommandBody.safeParse({ ...body, payload: { type: 'coord.approve', planId: '../x', digest: 'a'.repeat(64) } }).success);
  // Security review: a tap always names the plan it's about.
  assert.ok(!CommandBody.safeParse({ ...body, payload: { type: 'coord.approve', planId: 'pabcdefgh' } }).success);
  assert.ok(CoordPlanState.safeParse(plan()).success);
});

test('goal box: paired computers, their folders and agents; online first', () => {
  const cs = goalComputers([
    device({ deviceId: 'mac', name: 'Mac', online: false, setup: { adapters: ['claude-code', 'grok'], workspaces: 2, labels: ['taquito', 'chalyb'] } }),
    device({ deviceId: 'win', name: 'Windows', online: true }),
    device({ deviceId: 'old', name: 'Old', revoked: true }),
    device({ deviceId: 'phone', role: 'client', name: 'Phone' }),
  ]);
  assert.deepEqual(cs.map((c) => c.deviceId), ['win', 'mac']);
  assert.deepEqual(cs[1]!.workspaces, ['taquito', 'chalyb']);
  assert.deepEqual(cs[1]!.apps, ['claude-code', 'grok']);
  assert.deepEqual(cs[0]!.apps, ['claude-code', 'codex', 'grok', 'gemini']);
  const ok = { deviceId: 'mac', workspaceLabel: 'taquito', goal: 'add billing', app: 'grok' as const, maxAgents: 3, maxMinutes: 120 };
  assert.equal(goalProblem(ok, cs), null);
  assert.equal(goalProblem({ ...ok, deviceId: 'nope' }, cs), 'no_computer');
  assert.equal(goalProblem({ ...ok, workspaceLabel: ' ' }, cs), 'no_workspace');
  assert.equal(goalProblem({ ...ok, goal: 'x' }, cs), 'no_goal');
  assert.equal(goalProblem({ ...ok, goal: 'x'.repeat(4001) }, cs), 'goal_too_long');
  assert.equal(goalProblem({ ...ok, app: 'codex' }, cs), 'app');
  assert.equal(goalProblem({ ...ok, maxAgents: 9 }, cs), 'limits');
  assert.equal(goalProblem({ ...ok, maxMinutes: 1 }, cs), 'limits');
});

test('plan card: taps by status (approve and merge only when they apply; stop while anything can run)', () => {
  assert.deepEqual(planActions(plan()), { approve: true, merge: false, stop: true });
  assert.deepEqual(planActions(plan({ status: 'running' })), { approve: false, merge: false, stop: true });
  assert.deepEqual(planActions(plan({ status: 'ready_to_merge' })), { approve: false, merge: true, stop: true });
  for (const s of ['merged', 'stopped', 'failed'] as const) assert.deepEqual(planActions(plan({ status: s })), { approve: false, merge: false, stop: false });
  assert.deepEqual(planActions(plan({ tasks: [] })).approve, false);
  const p = plan({ status: 'running' });
  p.tasks[0]!.status = 'approved';
  p.tasks[1]!.status = 'failed';
  assert.deepEqual(planProgress(p), { done: 1, total: 2, failed: 1 });
  const list = plansOf([
    session({ sid: 'a', coord: plan({ updatedAt: 1 }) }),
    session({ sid: 'b' }),
    session({ sid: 'c', coord: plan({ planId: 'pzzzzzzzz', updatedAt: 9 }) }),
  ]);
  assert.deepEqual(list.map((x) => x.sid), ['c', 'a']);
});

test('Siempre así: only a verified MED prompt from a plan’s own coordinator, label from the signed details (D-075: never HIGH)', () => {
  assert.equal(isCoordOrigin('agent:coord_pabcdefgh'), true);
  for (const o of ['client:dev_p', 'agent:other', 'agent:coord_x']) assert.equal(isCoordOrigin(o), false, o);
  assert.deepEqual(rememberable(approval()), { kind: 'command', workspaceLabel: 'taquito', argv: ['pnpm', 'format'] });
  // Security review: exact command, allowlisted programs only (wrappers and other programs always ask).
  for (const command of ['supabase db push', 'npx foo --x', 'pnpm dev', 'make deploy'])
    assert.equal(rememberable(approval({ details: { toolName: 'Bash', input: { command }, workspaceLabel: 'taquito' } })), null, command);
  assert.equal(rememberable(approval({ risk: 'HIGH' })), null);
  assert.equal(rememberable(approval({ verified: false })), null);
  assert.equal(rememberable(approval({ origin: 'client:dev_p' })), null);
  assert.equal(rememberable(approval({ kind: 'computer_control' })), null);
  // Security review: no label in the signed details, nothing to remember (a plaintext column never counts).
  assert.equal(rememberable(approval({ details: { toolName: 'Bash', input: { command: 'pnpm format' } } })), null);
  assert.equal(rememberable(approval({ details: { toolName: 'Bash', input: { command: 'a && b' }, workspaceLabel: 'taquito' } })), null);
});

test('pop-up: the newest pending approval not put off and not expired', () => {
  const list = [approval({ aid: 'old', createdAt: 1 }), approval({ aid: 'new', createdAt: 5 }), approval({ aid: 'gone', createdAt: 9, expiresAt: 50 })];
  assert.equal(popupApproval(list, new Set(), 100)?.aid, 'new');
  assert.equal(popupApproval(list, new Set(['new']), 100)?.aid, 'old');
  assert.equal(popupApproval(list, new Set(['new', 'old']), 100), null);
  assert.equal(popupApproval([approval({ status: 'approved' })], new Set(), 1), null);
});

test('coordinator strings exist in both languages', () => {
  const keys = (o: unknown, p = ''): string[] =>
    Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
  const esK = keys((es as Record<string, unknown>).coord).sort();
  assert.ok(esK.length > 20);
  assert.deepEqual(esK, keys((en as Record<string, unknown>).coord).sort());
});
