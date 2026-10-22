import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as nodeModule from 'node:module';
import type { LoadFnOutput, LoadHookContext } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import swc from 'next/dist/build/swc/index.js';
import { ActionError, LiveStore, type ApprovalView, type DraftView, type EventView, type SessionView } from '@chalito/client';
import type { ClientKeys } from '@chalito/client';
import {
  buildTranscript,
  canStop,
  pendingFor,
  pillState,
  SUMMARY_MAX,
  toolSummary,
  answerable,
  canResume,
  fromKey,
  type ToolStep,
} from '@/lib/chalito/web/transcript';
import { createSessionActions, type ActionLanes } from '@/lib/chalito/web/session-actions';
import es from '../src/lib/chalito/messages/es.json' with { type: 'json' };
import en from '../src/lib/chalito/messages/en.json' with { type: 'json' };

// Node strips TypeScript but not JSX: compile .tsx with the SWC that ships with Next (as chalito-desktop-handoff-view).
await swc.loadBindings();
type Resolved = { url: string; shortCircuit?: boolean };
const { registerHooks } = nodeModule as unknown as {
  registerHooks: (hooks: {
    resolve?: (s: string, c: unknown, next: (s: string, c?: unknown) => Resolved) => Resolved;
    load?: (
      url: string,
      context: LoadHookContext,
      nextLoad: (url: string, context?: Partial<LoadHookContext>) => LoadFnOutput,
    ) => LoadFnOutput;
  }) => void;
};
// `next/image`, `next/link`…: next ships them as .js files without an exports map, which Node's ESM resolver needs.
registerHooks({
  resolve: (s, c, next) => (/^next\/[a-z-]+$/.test(s) ? next(`${s}.js`, c) : next(s, c)),
});
registerHooks({
  load(url, context, nextLoad) {
    if (!url.endsWith('.tsx')) return nextLoad(url, context);
    const filename = fileURLToPath(url);
    const { code } = swc.transformSync(readFileSync(filename, 'utf8'), {
      filename,
      jsc: {
        parser: { syntax: 'typescript', tsx: true },
        transform: { react: { runtime: 'automatic' } },
        target: 'es2022',
      },
      module: { type: 'es6' },
    });
    return { format: 'module', source: code, shortCircuit: true };
  },
});
const { SessionLive } = await import('@/components/tools/chalito/Sessions');

const SID = 'ses_1';
const AGENT = 'dev_agent';
let seq = 0;
const ev = (type: string, meta: Record<string, unknown> = {}, content: unknown = null): EventView => ({
  sid: SID,
  eid: `e${++seq}`,
  seq,
  t: 1_700_000_000_000 + seq,
  type,
  urgency: 'low',
  meta,
  content,
  rev: seq,
});

const session = (over: Partial<SessionView> = {}): SessionView => ({
  sid: SID,
  agentDeviceId: AGENT,
  adapter: 'claude-code',
  label: 'taquito',
  state: 'running',
  updatedAt: 1,
  card: null,
  coord: null,
  rev: 1,
  ...over,
});

const approval = (over: Partial<ApprovalView> = {}): ApprovalView =>
  ({
    aid: 'apr_1',
    sid: SID,
    agentDeviceId: AGENT,
    requestId: 'req_1',
    kind: 'tool',
    risk: 'MED',
    origin: 'local',
    stepUpRequired: false,
    status: 'pending',
    reason: null,
    createdAt: 1,
    expiresAt: Date.now() + 120_000,
    rev: 1,
    verified: true,
    detailsHash: 'a'.repeat(64),
    details: { toolName: 'Bash', summary: 'Bash: {"command":"pnpm test"}', input: { command: 'pnpm test' } },
    ...over,
  }) as ApprovalView;

type IntlProps = ComponentProps<typeof NextIntlClientProvider>;
type LiveProps = ComponentProps<typeof SessionLive>;
const noop = () => undefined;
const render = (over: Partial<LiveProps> = {}, locale: 'es' | 'en' = 'es') => {
  const intl = {
    locale,
    timeZone: 'America/Mexico_City',
    messages: { chalito: locale === 'es' ? es : en },
    onError: (e: Error & { code?: string }) => {
      throw e;
    },
  } as Omit<IntlProps, 'children'> as IntlProps;
  const props: LiveProps = {
    session: session(),
    events: [],
    draft: null,
    pending: [],
    note: null,
    onStop: noop,
    onResume: noop,
    onSend: async () => true,
    onMode: noop,
    onAnswered: noop,
    onAnswerFailed: noop,
    ...over,
  };
  return renderToStaticMarkup(createElement(NextIntlClientProvider, intl, createElement(SessionLive, props)));
};

// ---------------------------------------------------------------- transcript model

test('transcript: user and assistant bubbles, tool steps folded with their outcome, noise hidden', () => {
  const items = buildTranscript([
    ev('session.started', { adapter: 'claude-code' }),
    ev('message.user', { origin: 'client:dev_phone' }, { text: 'arregla el login' }),
    ev('session.state', { state: 'running' }),
    ev('tool.started', { toolUseId: 't1', category: 'shell', risk: 'MED' }, { toolName: 'Bash', input: { command: 'pnpm test\n  --run' } }),
    ev('tool.finished', { toolUseId: 't1', ok: true }),
    ev('tool.started', { toolUseId: 't2', category: 'edit', risk: 'LOW' }, { toolName: 'Edit', input: { file_path: 'src/login.ts' } }),
    ev('tool.finished', { toolUseId: 't2', ok: false }),
    ev('tool.started', { toolUseId: 't3', category: 'read', risk: 'LOW' }, null),
    ev('usage', { tokIn: 1, tokOut: 2 }),
    ev('approval.requested', { aid: 'apr_1' }),
    ev('message.assistant', { mid: 'm1' }, { text: 'Listo.' }),
    ev('error', { code: 'rate_limited' }),
  ]);
  assert.deepEqual(
    items.map((i) => i.kind),
    ['notice', 'user', 'tool', 'tool', 'tool', 'assistant', 'notice'],
  );
  const steps = items.filter((i) => i.kind === 'tool');
  assert.equal(steps.length, 3);
  const [t1, t2, t3] = steps as [ToolStep, ToolStep, ToolStep];
  assert.deepEqual([t1.summary, t1.category, t1.ok], ['pnpm test --run', 'shell', true]);
  assert.match(t1.detail ?? '', /"command": "pnpm test\\n  --run"/);
  assert.deepEqual([t2.summary, t2.ok], ['src/login.ts', false]);
  // Not sealed to this device: the step still shows, without content, and is still running.
  assert.deepEqual([t3.toolName, t3.summary, t3.detail, t3.ok], [null, null, null, null]);
  const last = items.at(-1);
  assert.ok(last);
  assert.deepEqual(last, { kind: 'notice', key: last.key, type: 'error', code: 'rate_limited' });
});

test('transcript: the live draft follows the conversation until its stored message lands', () => {
  const user = ev('message.user', { origin: 'local' }, { text: 'hola' });
  const draft: DraftView = { sid: SID, mid: 'm9', text: 'Estoy revis', seq: 99, pieces: 2 };
  assert.deepEqual(buildTranscript([user], draft).at(-1), { kind: 'draft', key: 'draft:m9', text: 'Estoy revis' });
  const final = ev('message.assistant', { mid: 'm9' }, { text: 'Estoy revisando.' });
  const items = buildTranscript([user, final], draft);
  assert.equal(items.filter((i) => i.kind === 'draft').length, 0);
  assert.equal(items.at(-1)?.kind, 'assistant');
});

test('transcript: agent text is shown as data (bidi overrides revealed) and summaries stay one short line', () => {
  const items = buildTranscript([ev('message.assistant', {}, { text: 'rm \u202Eexe.txt' })]);
  const first = items[0];
  assert.ok(first?.kind === 'assistant');
  assert.equal(first.text, 'rm ⟦U+202E⟧exe.txt');
  const long = toolSummary({ command: 'x'.repeat(500) });
  assert.ok(long);
  assert.equal(long.length, SUMMARY_MAX);
  assert.ok(long.endsWith('…'));
  assert.equal(toolSummary({}), null);
  assert.equal(toolSummary({ other: 1 }), '{"other":1}');
});

test('pill: running, waiting for you (also when an approval is pending), idle, ended', () => {
  assert.equal(pillState('running', 0), 'running');
  assert.equal(pillState('starting', 0), 'running');
  assert.equal(pillState('running', 1), 'waiting');
  assert.equal(pillState('waiting_input', 0), 'waiting');
  assert.equal(pillState('waiting_approval', 0), 'waiting');
  assert.equal(pillState('idle', 0), 'idle');
  // Stopped from the phone: paused (Resume brings it back), not over.
  assert.equal(pillState('interrupted', 0), 'idle');
  for (const s of ['completed', 'failed']) assert.equal(pillState(s, 2), 'ended');
  // Before the agent reports a state (a new session) Stop is offered: a turn may already be running.
  assert.equal(canStop(undefined), true);
  assert.equal(canStop('running'), true);
  assert.equal(canStop('waiting_approval'), true);
  assert.equal(canStop('idle'), false);
  assert.equal(canStop('completed'), false);
  assert.deepEqual(['idle', 'interrupted', 'completed', 'running'].map(canResume), [true, true, false, false]);
});

test('fromKey: each signed origin gets its own label; nothing unknown passes as the owner', () => {
  assert.equal(fromKey('client:dev_phone'), 'client');
  assert.equal(fromKey('local'), 'local');
  assert.equal(fromKey('agent:coord_pabcdefgh'), 'agent');
  assert.equal(fromKey('a2a:peer'), 'agent');
  assert.equal(fromKey('mcp:chatgpt'), 'mcp');
  assert.equal(fromKey('call:CA' + '0'.repeat(32)), 'call');
  assert.equal(fromKey('room:x'), 'other');
  assert.equal(fromKey(null), 'other');
});

test('pendingFor: only this session and only pending (an overdue one stays, to show "expired"); answerable counts the live ones', () => {
  const list = [
    approval({ aid: 'a', expiresAt: 2_000 }),
    approval({ aid: 'b', sid: 'ses_other', expiresAt: 2_000 }),
    approval({ aid: 'c', status: 'approved', expiresAt: 2_000 }),
    approval({ aid: 'd', expiresAt: 999 }),
  ];
  const mine = pendingFor(list, SID);
  assert.deepEqual(mine.map((a) => a.aid), ['a', 'd']);
  assert.equal(answerable(mine, 1_000), 1);
});

test('transcript: steps still open when the session ended show as stopped; unknown categories and events stay quiet', () => {
  const evs = [
    ev('tool.started', { toolUseId: 'a', category: 'shell', risk: 'LOW' }, null),
    ev('tool.started', { toolUseId: 'b', category: 'teleport', risk: 'LOW' }, null),
    ev('tool.finished', { toolUseId: 'b', ok: true }),
    ev('tool.finished', { toolUseId: 'nobody', ok: false }),
    ev('terminal.started', {}),
    ev('policy.changed', {}),
  ];
  const live = buildTranscript(evs);
  assert.deepEqual(live.map((i) => i.kind === 'tool' && [i.category, i.ok, i.stopped]), [['shell', null, false], ['other', true, false]]);
  const over = buildTranscript(evs, null, true);
  assert.deepEqual(over.map((i) => i.kind === 'tool' && i.stopped), [true, false]);
});

// ---------------------------------------------------------------- the page

test('page: streaming draft shows as a live bubble after the conversation', () => {
  const html = render({
    events: [ev('message.user', { origin: 'client:dev_phone' }, { text: 'arregla el login' })],
    draft: { sid: SID, mid: 'm1', text: 'Voy a revisar login.ts', seq: 50, pieces: 3 },
  });
  assert.match(html, /data-testid="msg-user"[^>]*>.*Tú<\/span><p[^>]*>arregla el login/);
  assert.match(html, /data-testid="msg-draft"[^>]*aria-busy="true"[^>]*><p[^>]*>Voy a revisar login\.ts/);
  assert.match(html, />Escribiendo…</);
  assert.ok(html.indexOf('msg-user') < html.indexOf('msg-draft'));
});

test('page: this session’s pending approval is inline with the approve card, not a count', () => {
  const html = render({ pending: [approval()] });
  assert.match(html, /data-testid="session-approvals"/);
  assert.match(html, /Te espera 1 aprobación/);
  assert.match(html, /data-testid="approval"[^>]*data-aid="apr_1"[^>]*data-status="pending"/);
  // Verified MED: approvable here (no passkey needed), with the summary the owner signs.
  assert.match(html, /<button[^>]*class="ch-btn ch-btn--primary"[^>]*data-testid="approve"[^>]*>Aprobar</);
  assert.doesNotMatch(html, /data-testid="approve"[^>]*disabled/);
  assert.match(html, /data-testid="approval-summary"[^>]*>Bash: \{&quot;command&quot;:&quot;pnpm test&quot;\}/);
  // Already on the session: no "open session" link inside the card.
  assert.doesNotMatch(html, /\/sesiones\/ses_1"/);
  // HIGH asks for this device's passkey, which this browser doesn't have: still shown, not approvable.
  const high = render({ pending: [approval({ risk: 'HIGH', stepUpRequired: true })] });
  assert.match(high, /data-testid="needs-passkey"/);
  assert.match(high, /data-testid="approve"[^>]*>Aprobar/);
  assert.match(high, /<button[^>]*disabled=""[^>]*data-testid="approve"/);
});

test('page: big Stop and the pill while working; no Stop once it ended; composer always there', () => {
  const working = render();
  assert.match(working, /data-testid="session-stop"[^>]*>.*Detener<\/button>/);
  assert.match(working, /data-testid="session-pill" data-state="running"[^>]*>Trabajando</);
  assert.match(working, /data-testid="composer"/);
  const waiting = render({ pending: [approval()] });
  assert.match(waiting, /data-state="waiting"[^>]*>Te está esperando</);
  const ended = render({ session: session({ state: 'completed' }) });
  assert.doesNotMatch(ended, /session-stop/);
  assert.match(ended, /data-state="ended"[^>]*>Terminada</);
  assert.match(ended, /data-testid="composer"/);
  assert.doesNotMatch(ended, /session-resume/);
  // After Stop: paused, and Resume is the big button.
  const stopped = render({ session: session({ state: 'interrupted' }) });
  assert.match(stopped, /data-state="idle"[^>]*>En pausa</);
  assert.match(stopped, /data-testid="session-resume"[^>]*>.*Reanudar<\/button>/);
  assert.doesNotMatch(stopped, /session-stop/);
});

test('page: after Stop, a step that was running shows as not finished, not running', () => {
  const evs = [ev('tool.started', { toolUseId: 'x', category: 'shell', risk: 'MED' }, { toolName: 'Bash', input: { command: 'sleep 99' } })];
  assert.match(render({ events: evs }), /data-testid="tool-step"[^>]*data-status="running"/);
  for (const state of ['interrupted', 'idle', 'completed', 'failed'])
    assert.match(render({ events: evs, session: session({ state }) }), /data-testid="tool-step"[^>]*data-status="stopped"/, state);
});

test('page: a prompt on its way disables Send and the mode picker but never Stop; Stop has its own flag', () => {
  const html = render({ busy: true });
  assert.doesNotMatch(html, /data-testid="session-stop"[^>]*disabled/);
  assert.match(html, /<select data-testid="permission-mode"[^>]*disabled=""/);
  assert.match(html, /data-testid="composer".*<button[^>]*disabled=""[^>]*aria-label="Enviar"/);
  assert.match(render({ stopBusy: true }), /<button type="button" data-testid="session-stop"[^>]*disabled=""/);
  // Ready but nothing typed: Send stays off too.
  assert.match(render(), /data-testid="composer".*<button[^>]*disabled=""[^>]*aria-label="Enviar"/);
  assert.doesNotMatch(render(), /data-testid="session-stop"[^>]*disabled/);
});

test('actions: Stop goes out at once while a prompt is still on its way; repeat taps on one lane are skipped', async () => {
  const calls: string[] = [];
  let lanes: ActionLanes = { busy: false, stopping: false };
  const hang = () => new Promise<never>(() => undefined);
  const client = {
    actions: {
      prompt: async () => (calls.push('prompt'), hang()),
      interrupt: async () => void calls.push('interrupt'),
      resume: async () => void calls.push('resume'),
      setPermissionMode: async () => void calls.push('mode'),
    },
  };
  const a = createSessionActions(client, SID, (l) => (lanes = l));
  void a.prompt('sigue');
  await Promise.resolve();
  assert.deepEqual(lanes, { busy: true, stopping: false });
  assert.equal(await a.stop(), 'ok');
  assert.deepEqual(calls, ['prompt', 'interrupt']);
  assert.deepEqual(lanes, { busy: true, stopping: false });
  // The prompt lane is still busy: a second prompt or a resume is a repeat tap.
  assert.equal(await a.prompt('otra'), 'skipped');
  assert.equal(await a.resume(), 'skipped');
  assert.deepEqual(calls, ['prompt', 'interrupt']);
});

test('actions: a Stop on its way skips repeat Stops; errors map to untrusted / failed', async () => {
  let release: () => void = noop;
  const calls: string[] = [];
  const client = {
    actions: {
      prompt: async () => {
        throw new ActionError('untrusted_agent', 'x');
      },
      interrupt: async () => {
        calls.push('interrupt');
        await new Promise<void>((r) => (release = r));
      },
      resume: async () => {
        throw new Error('network');
      },
      setPermissionMode: async () => undefined,
    },
  };
  const a = createSessionActions(client, SID, noop);
  const first = a.stop();
  assert.equal(await a.stop(), 'skipped');
  release();
  assert.equal(await first, 'ok');
  assert.deepEqual(calls, ['interrupt']);
  assert.equal(await a.prompt('x'), 'untrusted');
  assert.equal(await a.resume(), 'failed');
});

test('page: the approvals heading counts only answerable ones; an overdue card says expired', () => {
  const live = approval();
  const overdue = approval({ aid: 'apr_old', expiresAt: Date.now() - 1_000 });
  assert.match(render({ pending: [live, overdue] }), /Te espera 1 aprobación/);
  const onlyOld = render({ pending: [overdue] });
  assert.match(onlyOld, /Aprobaciones vencidas/);
  assert.match(onlyOld, /data-aid="apr_old" data-status="expired"/);
  assert.match(onlyOld, /data-state="running"/);
});

test('page: when the start of the session is gone, a line says earlier messages are not shown', () => {
  const late = { ...ev('message.user', { origin: 'local' }, { text: 'hola' }), seq: 250 };
  assert.match(render({ events: [late] }), /data-testid="transcript-earlier"[^>]*>Los mensajes anteriores ya no se muestran\./);
  const start = { ...ev('session.started', {}), seq: 0 };
  assert.doesNotMatch(render({ events: [start, late] }), /transcript-earlier/);
  assert.doesNotMatch(render(), /transcript-earlier/);
});

test('page: a prompt from another agent is labeled as such, not as the owner', () => {
  const html = render({ events: [ev('message.user', { origin: 'agent:coord_pabcdefgh' }, { text: 'sigue con la UI' })] });
  assert.match(html, /data-testid="msg-user"[^>]*><span class="ch-chl-msg__who">Otro agente<\/span>/);
});

test('page: tool steps fold to category + one line; the whole input opens on tap', () => {
  const html = render({
    events: [
      ev('tool.started', { toolUseId: 't1', category: 'shell', risk: 'MED' }, { toolName: 'Bash', input: { command: 'pnpm test' } }),
      ev('tool.finished', { toolUseId: 't1', ok: true }),
    ],
  });
  assert.match(html, /data-testid="tool-step" data-category="shell" data-status="ok"/);
  assert.match(html, /<details class="ch-chl-step__fold"><summary><span class="ch-chl-step__cat">Terminal<\/span>/);
  assert.match(html, /data-testid="tool-step-detail"[^>]*>\{\n {2}&quot;command&quot;: &quot;pnpm test&quot;\n\}/);
});

test('page: every new string exists in Spanish and English', () => {
  const props: Partial<LiveProps> = {
    events: [
      ev('message.user', { origin: 'local' }, { text: 'a' }),
      ev('message.assistant', {}, null),
      ...(['read', 'search', 'edit', 'create', 'delete', 'shell', 'web', 'mcp', 'git', 'other'] as const).map((c) =>
        ev('tool.started', { toolUseId: c, category: c, risk: 'LOW' }, null),
      ),
      ...['adapter_crash', 'auth_required', 'rate_limited', 'quota_exhausted', 'policy_block', 'internal'].map((code) =>
        ev('error', { code }),
      ),
    ],
    draft: { sid: SID, mid: 'm', text: 'x', seq: 99, pieces: 1 },
    pending: [approval(), approval({ aid: 'apr_2' })],
  };
  for (const locale of ['es', 'en'] as const)
    for (const state of ['running', 'idle', 'completed'])
      assert.doesNotThrow(() => render({ ...props, session: session({ state }) }, locale), `${locale} ${state}`);
  assert.match(render(props, 'en'), /2 approvals waiting for you/);
});

// ---------------------------------------------------------------- real store → page

const b64 = (n: number) => Buffer.alloc(n, 7).toString('base64url');
/** A sealed envelope whose `ct` names the plaintext in `PLAIN` (the fake keys below open it). */
const PLAIN = new Map<string, unknown>();
const sealed = (value: unknown) => {
  const id = Buffer.from(`p${PLAIN.size}`).toString('base64url');
  PLAIN.set(id, value);
  return { alg: 'xchacha20poly1305+sealedbox', nonce: b64(24), ct: id, keys: { dev_phone: b64(80) } };
};

test('real LiveStore: message.assistant.delta broadcasts build the draft the page shows, then the stored message replaces it', async () => {
  type Row = Record<string, unknown>;
  const rows: Record<'sessions' | 'session_events' | 'approvals' | 'notifications' | 'devices', Row[]> = {
    sessions: [{ sid: SID, device_id: AGENT, owner: 'u1', rev: 1, updated_at: '2026-10-21T00:00:00Z', doc: { state: 'running', label: 'taquito' } }],
    session_events: [],
    approvals: [],
    notifications: [],
    devices: [],
  };
  const query = (table: string) => {
    const q = {
      select: () => q,
      eq: () => q,
      gt: (_c: string, v: unknown) => ((q.min = Number(v)), q),
      order: () => q,
      limit: () => q,
      min: 0,
      then: (ok: (r: unknown) => unknown) =>
        Promise.resolve({ data: (rows[table as keyof typeof rows] ?? []).filter((r) => Number(r.rev) > q.min), error: null }).then(ok),
    };
    return q;
  };
  let onBroadcast: (msg: { payload?: unknown }) => void = noop;
  let onStatus: (s: string) => void = noop;
  const channel = {
    on: (_t: string, _f: unknown, cb: typeof onBroadcast) => ((onBroadcast = cb), channel),
    subscribe: (cb: typeof onStatus) => ((onStatus = cb), channel),
  };
  const db = { from: query, channel: () => channel, removeChannel: async () => undefined };
  const keys = {
    deviceId: 'dev_phone',
    open: async (env: { ct: string }) => PLAIN.get(env.ct),
  } as unknown as ClientKeys;
  const store = new LiveStore(db as never, keys, 'u1');
  store.start();
  await store.joined();
  onStatus('SUBSCRIBED');
  await store.resync();

  const delta = (n: number, text: string, deviceId = AGENT) => ({
    v: 1, eid: `d${n}`, sid: SID, deviceId, seq: 7, t: 1_700_000_000_000, urgency: 'low',
    type: 'message.assistant.delta', mid: 'm1', n, ct: sealed({ text }),
  });
  const live = async (events: unknown[], deviceId = AGENT) => {
    onBroadcast({ payload: { table: 'live', op: 'events', deviceId, events } });
    await new Promise((r) => setTimeout(r, 10));
  };
  await live([delta(0, 'Voy a '), delta(1, 'revisar')]);
  // A repeat and a different device's piece are both dropped.
  await live([delta(1, 'revisar')]);
  await live([delta(2, ' MALO', 'dev_evil')], 'dev_evil');
  const page = () => {
    const snap = store.getSnapshot();
    return render({
      session: snap.sessions[0]!,
      events: snap.events[SID] ?? [],
      draft: snap.drafts[SID] ?? null,
    });
  };
  assert.match(page(), /data-testid="msg-draft"[^>]*><p[^>]*>Voy a revisar<span/);

  rows.session_events.push({
    sid: SID, eid: 'e_final', seq: 7, t: '2026-10-21T00:00:01Z', type: 'message.assistant', urgency: 'low', rev: 2,
    doc: { mid: 'm1', ct: sealed({ text: 'Voy a revisar login.ts.' }) },
  });
  onBroadcast({ payload: { table: 'session_events', op: 'insert' } });
  await new Promise((r) => setTimeout(r, 10));
  const after = page();
  assert.doesNotMatch(after, /msg-draft/);
  assert.match(after, /data-testid="msg-assistant"[^>]*><p[^>]*>Voy a revisar login\.ts\./);
  await store.stop();
});
