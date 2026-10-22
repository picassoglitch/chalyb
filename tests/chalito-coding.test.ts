import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentEvent } from '../src/lib/chalito/pkg/protocol/agentEvent';
import { CommandPayload } from '../src/lib/chalito/pkg/protocol/command';
import { ProviderConnectionDoc } from '../src/lib/chalito/pkg/protocol/provider';
import { actionsFor, parseConnection, toSettingsConnection } from '@/lib/chalito/web/connect';
import {
  httpCoding,
  latestBlock,
  parseCodingSettings,
  parseTokens,
  spendByAgent,
} from '@/lib/chalito/web/coding';
import es from '../src/lib/chalito/messages/es.json' with { type: 'json' };
import en from '../src/lib/chalito/messages/en.json' with { type: 'json' };

// "IA de Chalyb" for coding agents (picassoglitch/chalito ADR 0030).
const agent = (id: string) => ({
  id,
  group: 'agent' as const,
  planSignin: 'on' as const,
  installable: true,
  apiKey: { label: 'k', docsUrl: 'https://x' },
});

test('IA de Chalyb is offered first for Codex, Grok and Gemini, only while it is on for this plan, never for Claude Code', () => {
  for (const id of ['codex', 'grok', 'gemini']) {
    assert.deepEqual(actionsFor(null, agent(id), true), ['chalyb', 'api_key', 'signin'], id);
    assert.deepEqual(actionsFor(null, agent(id), false), ['api_key', 'signin'], id);
  }
  assert.deepEqual(actionsFor(null, agent('claude-code'), true), ['api_key', 'signin']);
  assert.deepEqual(actionsFor(null, agent('goose'), true), ['api_key', 'signin']);
  const connected = {
    appId: 'codex',
    deviceId: 'd',
    state: 'connected',
    mode: 'chalyb',
    connected: true,
    cli: null,
    error: null,
    at: 1,
  } as const;
  assert.deepEqual(actionsFor(connected, agent('codex'), true), ['disconnect']);
});

test('a computer reporting chalyb mode reads as connected through IA de Chalyb', () => {
  const doc = {
    mode: 'chalyb',
    connected: true,
    state: 'connected',
    cli: { installed: true, version: '0.163.0' },
    error: null,
    at: 5,
  };
  assert.ok(ProviderConnectionDoc.safeParse(doc).success);
  const row = { provider: 'codex', device_id: 'd1', doc };
  assert.equal(parseConnection(row)?.mode, 'chalyb');
  assert.equal(toSettingsConnection(row)?.mode, 'chalyb');
});

test('protocol sync: app.connect {method: chalyb} carries no key; session.blocked parses', () => {
  assert.ok(
    CommandPayload.safeParse({ type: 'app.connect', appId: 'codex', method: 'chalyb' }).success,
  );
  assert.ok(
    !CommandPayload.safeParse({
      type: 'app.connect',
      appId: 'codex',
      method: 'chalyb',
      keyCt: { alg: 'x' },
    }).success,
  );
  const e = AgentEvent.safeParse({
    v: 1,
    eid: 'e1',
    sid: 's1',
    deviceId: 'd1',
    seq: 3,
    t: 1,
    urgency: 'normal',
    type: 'session.blocked',
    reason: 'daily_cap',
  });
  assert.ok(e.success);
  assert.ok(
    !AgentEvent.safeParse({
      v: 1,
      eid: 'e1',
      sid: 's1',
      deviceId: 'd1',
      seq: 3,
      t: 1,
      urgency: 'normal',
      type: 'session.blocked',
      reason: 'other',
    }).success,
  );
});

const settings = {
  enabled: true,
  eligible: true,
  tier: 'pro',
  dailyCapTokens: 1_250_000,
  defaultCapTokens: 1_250_000,
  ceilingTokens: 5_000_000,
  today: { day: '2026-10-21', billableTokens: 1500 },
  days: [
    { day: '2026-10-20', agent: 'codex', billableTokens: 7, requests: 1 },
    { day: '2026-10-21', agent: 'codex', billableTokens: 1000, requests: 2 },
    { day: '2026-10-21', agent: 'gemini-cli', billableTokens: 500, requests: 1 },
    { day: '2026-10-21', agent: 'claude-code', billableTokens: 9, requests: 1 },
  ],
};

test('the settings answer is read strictly; unknown agents are dropped; spend sums per agent', () => {
  const s = parseCodingSettings(settings);
  assert.ok(s);
  assert.equal(s.days.length, 3);
  assert.deepEqual(spendByAgent(s), [
    { agent: 'codex', billableTokens: 1007, requests: 3 },
    { agent: 'gemini-cli', billableTokens: 500, requests: 1 },
  ]);
  assert.equal(parseCodingSettings({ ...settings, dailyCapTokens: -1 }), null);
  assert.equal(parseCodingSettings({ ...settings, enabled: 'yes' }), null);
});

test('saving the cap: the passkey assertion goes along only when given; the api reason comes back', async () => {
  const sent: unknown[] = [];
  let answer: { status: number; body: unknown } = {
    status: 200,
    body: { ok: true, dailyCapTokens: 100 },
  };
  const fake = (async (_url: string, init?: RequestInit) => {
    sent.push(init?.body ? JSON.parse(String(init.body)) : null);
    return new Response(JSON.stringify(answer.body), { status: answer.status });
  }) as unknown as typeof fetch;
  const api = httpCoding('https://api.test', async () => 'tok', fake);
  assert.deepEqual(await api.setCap(100), { ok: true, dailyCapTokens: 100 });
  assert.deepEqual(sent.at(-1), { dailyCapTokens: 100 });
  answer = { status: 401, body: { error: 'step_up_required' } };
  assert.deepEqual(await api.setCap(2_000_000, { a: 1 }), {
    ok: false,
    reason: 'step_up_required',
  });
  assert.deepEqual(sent.at(-1), { dailyCapTokens: 2_000_000, stepUp: { a: 1 } });
  answer = { status: 500, body: { error: 'internal' } };
  assert.deepEqual(await api.setCap(1), { ok: false, reason: 'failed' });
  // An api without IA de Chalyb (the route isn't mounted): nothing is shown, not an error.
  answer = { status: 404, body: { error: 'not_found' } };
  assert.equal(await api.settings(), 'unavailable');
  answer = { status: 503, body: {} };
  assert.equal(await api.settings(), 'error');
});

test('the session chip: the latest block shows until the agent answers again', () => {
  const ev = (type: string, seq: number, meta: Record<string, unknown> = {}) => ({
    type,
    seq,
    meta,
  });
  assert.equal(latestBlock([ev('message.assistant', 1)]), null);
  assert.equal(
    latestBlock([
      ev('message.assistant', 1),
      ev('session.blocked', 2, { reason: 'out_of_energy' }),
    ]),
    'out_of_energy',
  );
  assert.equal(
    latestBlock([
      ev('session.blocked', 2, { reason: 'out_of_energy' }),
      ev('message.assistant', 3),
    ]),
    null,
  );
  assert.equal(
    latestBlock([
      ev('session.blocked', 2, { reason: 'out_of_energy' }),
      ev('message.assistant', 3),
      ev('session.blocked', 4, { reason: 'daily_cap' }),
    ]),
    'daily_cap',
  );
});

test('the copy exists in both languages', () => {
  for (const m of [es, en] as unknown as Record<
    string,
    Record<string, Record<string, unknown>>
  >[]) {
    assert.equal(typeof (m.connect!.actions as Record<string, string>).chalyb, 'string');
    assert.equal(typeof m.connect!.chalybClaude, 'string');
    for (const k of ['cap', 'usage', 'blocked']) assert.ok(m.coding![k], k);
  }
  assert.deepEqual(Object.keys(es.coding.cap.note).sort(), Object.keys(en.coding.cap.note).sort());
});

test('the cap field takes whole tokens only; it never guesses what was meant', () => {
  assert.equal(parseTokens('1250000'), 1_250_000);
  assert.equal(parseTokens(' 1,250,000 '), 1_250_000);
  assert.equal(parseTokens('2.5'), null);
  assert.equal(parseTokens('1e6'), null);
  assert.equal(parseTokens(''), null);
  assert.equal(parseTokens('-5'), null);
});

test('the session timeline names session.blocked in both languages', () => {
  assert.equal(typeof es.live.timeline.type.session_blocked, 'string');
  assert.equal(typeof en.live.timeline.type.session_blocked, 'string');
  assert.match(es.coding.usage.line, /plural/);
});
