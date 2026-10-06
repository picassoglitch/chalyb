import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CommandBody,
  CommandPayload,
  Provider,
  ProviderConnectionDoc as ProviderStatusDoc,
  AppConnectionDoc,
  AdapterKind,
} from '@chalito/protocol';
import {
  COMMAND_WAIT_MS,
  actionsFor,
  checkApiKey,
  cleanApiKey,
  indexConnections,
  latestAt,
  parseConnection,
  pendingOutcome,
  toSettingsConnection,
  signinGate,
  withTimeout,
  type ProviderStatus,
} from '@/lib/chalito/web/connect';
import { agentOptions } from '@/lib/chalito/web/providers';
import es from '../src/lib/chalito/messages/es.json' with { type: 'json' };
import en from '../src/lib/chalito/messages/en.json' with { type: 'json' };

const env = {
  alg: 'xchacha20poly1305+sealedbox',
  nonce: 'A'.repeat(32),
  ct: 'abc',
  keys: { agent1: 'B'.repeat(107) },
} as const;

const body = (payload: unknown) => ({
  v: 1,
  cid: 'c1',
  uid: 'u1',
  targetDeviceId: 'agent1',
  origin: 'client:web1',
  nonce: 'A'.repeat(22),
  issuedAt: 1000,
  expiresAt: 2000,
  payload,
});

test('protocol: the four providers and the provider.* commands, as in the connect contract', () => {
  assert.deepEqual(Provider.options, ['anthropic', 'openai', 'xai', 'google']);
  assert.ok(AdapterKind.options.includes('grok') && AdapterKind.options.includes('gemini'));
  for (const p of [
    { type: 'provider.connect', provider: 'google', method: 'api_key', keyCt: env },
    { type: 'provider.connect', provider: 'xai', method: 'signin' },
    { type: 'provider.disconnect', provider: 'openai' },
    { type: 'provider.install', provider: 'anthropic' },
    { type: 'provider.status' },
  ])
    assert.ok(CommandPayload.safeParse(p).success, p.type);
  assert.equal(
    CommandPayload.safeParse({ type: 'provider.connect', provider: 'mistral', method: 'signin' })
      .success,
    false,
  );
  // keyCt exactly when method = api_key.
  assert.ok(
    CommandBody.safeParse(
      body({ type: 'provider.connect', provider: 'xai', method: 'api_key', keyCt: env }),
    ).success,
  );
  assert.equal(
    CommandBody.safeParse(body({ type: 'provider.connect', provider: 'xai', method: 'api_key' }))
      .success,
    false,
  );
  assert.equal(
    CommandBody.safeParse(
      body({ type: 'provider.connect', provider: 'xai', method: 'signin', keyCt: env }),
    ).success,
    false,
  );
  // A plaintext key has nowhere to go.
  const plain = CommandPayload.parse({
    type: 'provider.connect',
    provider: 'xai',
    method: 'signin',
    key: 'sk-123',
  } as never);
  assert.equal('key' in plain, false);
  const doc = {
    mode: 'signin',
    connected: false,
    state: 'signing_in',
    cli: { installed: true, version: '1.2.3' },
    error: null,
    at: 5,
  };
  assert.ok(ProviderStatusDoc.safeParse(doc).success);
  assert.equal(ProviderStatusDoc.safeParse({ ...doc, state: 'hacked' }).success, false);
});

const status = (over: Partial<ProviderStatus> = {}): ProviderStatus => ({
  appId: 'grok',
  deviceId: 'd1',
  state: 'needs_auth',
  mode: null,
  connected: false,
  cli: { installed: true, version: null },
  error: null,
  at: 10,
  ...over,
});

test('connections: status reports, pre-contract rows and junk', () => {
  const doc = {
    mode: 'api_key',
    connected: true,
    state: 'connected',
    cli: { installed: true, version: '0.9' },
    error: null,
    at: 42,
  };
  // Pre-engine provider names map to their app ids.
  assert.deepEqual(parseConnection({ provider: 'google', device_id: 'd1', doc }), {
    appId: 'gemini',
    deviceId: 'd1',
    ...doc,
  });
  // Engine rows: any app id, with kind/custom/name.
  const appDoc = { ...doc, state: 'available', connected: false, mode: null, kind: 'web-app', custom: false };
  assert.ok(AppConnectionDoc.safeParse(appDoc).success);
  assert.equal(parseConnection({ provider: 'perplexity', device_id: 'd1', doc: appDoc })?.state, 'available');
  assert.equal(parseConnection({ provider: 'claude-code', device_id: 'd1', doc })?.appId, 'claude-code');
  const legacy = parseConnection({
    provider: 'openai',
    device_id: 'd1',
    doc: { mode: 'byo_subscription_local', connected: true },
  });
  assert.equal(legacy?.state, 'connected');
  assert.equal(legacy?.mode, 'signin');
  assert.equal(parseConnection({ provider: 'Not An Id!', device_id: 'd1', doc }), null);
  assert.equal(parseConnection({ provider: 'xai', device_id: 'd1', doc: { nope: 1 } }), null);
  const idx = indexConnections([
    { provider: 'xai', device_id: 'd1', doc },
    { provider: 'google', device_id: 'd2', doc },
    { provider: 'BAD id', device_id: 'd3', doc },
  ]);
  assert.deepEqual(Object.keys(idx).sort(), ['d1', 'd2']);
  // Settings' read-only view keeps working with the new doc shape.
  assert.deepEqual(toSettingsConnection({ provider: 'google', device_id: 'd1', doc }), {
    provider: 'gemini',
    deviceId: 'd1',
    mode: 'byo_api_key',
    connected: true,
  });
});

test('actions per state, with the plan sign-in gated by subscriptionLocal', () => {
  const agent = { group: 'agent', installable: true, apiKey: { label: 'API key', docsUrl: 'https://x' } } as const;
  const on = { ...agent, planSignin: 'on' } as const;
  const off = { ...agent, planSignin: 'off' } as const;
  const owner = { ...agent, planSignin: 'owner_only' } as const;
  assert.deepEqual(actionsFor(null, on), ['api_key', 'signin']);
  assert.deepEqual(actionsFor(null, off), ['api_key']);
  assert.deepEqual(actionsFor(null, owner), ['api_key', 'signin']);
  assert.deepEqual(actionsFor(status({ state: 'not_installed' }), on), ['install']);
  assert.deepEqual(actionsFor(status({ state: 'installing' }), on), []);
  assert.deepEqual(actionsFor(status({ state: 'signing_in' }), on), []);
  assert.deepEqual(actionsFor(status({ state: 'connected' }), on), ['disconnect']);
  assert.deepEqual(actionsFor(status({ state: 'needs_auth' }), off), ['api_key']);
  assert.deepEqual(actionsFor(status({ state: 'blocked_by_policy' }), owner), ['api_key']);
  assert.deepEqual(actionsFor(status({ state: 'error' }), on), ['api_key', 'signin']);
  assert.deepEqual(
    actionsFor(status({ state: 'error', cli: { installed: false, version: null } }), on),
    ['install'],
  );
  // An agent with no API key (goose, opencode): only its own sign-in.
  assert.deepEqual(actionsFor(null, { ...on, apiKey: undefined }), ['signin']);
  // Desktop apps and websites: open them on that computer; install a missing desktop app.
  const web = { group: 'web', planSignin: 'on', installable: false } as const;
  const desktop = { group: 'desktop', planSignin: 'on', installable: true } as const;
  assert.deepEqual(actionsFor(null, web), ['launch']);
  assert.deepEqual(actionsFor(status({ state: 'available' }), web), ['launch']);
  assert.deepEqual(actionsFor(status({ state: 'not_installed' }), desktop), ['install']);
  assert.deepEqual(actionsFor(status({ state: 'not_installed' }), { ...desktop, installable: false }), []);
  assert.equal(signinGate('approved'), 'on');
  assert.equal(signinGate('nonsense'), 'off');
});

test('a command waits for a newer report, then times out (no endless spinner)', async () => {
  const p = { action: 'install' as const, sentAt: 1000, prevAt: 10 };
  assert.equal(pendingOutcome(p, 10, 2000), 'waiting');
  assert.equal(pendingOutcome(p, 11, 2000), 'answered');
  assert.equal(pendingOutcome(p, 10, 1000 + COMMAND_WAIT_MS), 'timeout');
  assert.equal(latestAt([]), -1);
  assert.equal(latestAt([null, status({ at: 3 }), status({ at: 7 })]), 7);
  await assert.rejects(withTimeout(new Promise(() => undefined), 5), /timeout/);
  assert.equal(await withTimeout(Promise.resolve(1), 50), 1);
});

test('API keys are checked before they leave the browser', () => {
  assert.equal(cleanApiKey('  sk-abcdef123  '), 'sk-abcdef123');
  assert.equal(cleanApiKey('short'), null);
  assert.equal(cleanApiKey('sk-abc def123'), null);
});

test('a pasted key must look like its provider\'s before it is sealed', () => {
  assert.deepEqual(checkApiKey('claude-code', ' sk-ant-api03-abcdef '), { ok: true, key: 'sk-ant-api03-abcdef' });
  assert.deepEqual(checkApiKey('claude-code', 'sk-proj-abcdef12'), { ok: true, key: 'sk-proj-abcdef12', warn: 'sk-ant-' });
  assert.deepEqual(checkApiKey('codex', 'sk-proj-abcdef12'), { ok: true, key: 'sk-proj-abcdef12' });
  // An Anthropic key in the Codex field is the usual mix-up.
  assert.deepEqual(checkApiKey('codex', 'sk-ant-api03-abcdef'), { ok: true, key: 'sk-ant-api03-abcdef', warn: 'sk-' });
  assert.equal(checkApiKey('grok', 'xai-abcdef1234').ok, true);
  assert.deepEqual(checkApiKey('gemini', 'xai-abcdef1234'), { ok: true, key: 'xai-abcdef1234', warn: 'AIza' });
  assert.equal(checkApiKey('gemini', 'AIzaSyAbcdef123').ok, true);
  // No fixed shape for other apps: only the basic checks.
  assert.equal(checkApiKey('aider', 'anything-12345').ok, true);
  assert.deepEqual(checkApiKey('aider', 'short'), { ok: false, error: 'invalid' });
});

test('the hub offers all four agents, Gemini included, with the contract gates', () => {
  const opts = agentOptions();
  assert.deepEqual(
    opts.map((o) => [o.provider, o.subscription]),
    [
      ['anthropic', 'owner_only'],
      ['openai', 'owner_only'],
      ['xai', 'on'],
      ['google', 'on'],
    ],
  );
});

test('connect copy exists in es and en for every state, action and provider', () => {
  for (const m of [es, en]) {
    const c = m.connect as unknown as Record<string, Record<string, string>>;
    for (const s of [
      'unknown',
      'not_installed',
      'installing',
      'needs_auth',
      'signing_in',
      'connected',
      'error',
      'blocked_by_policy',
    ])
      assert.ok(c.state?.[s], s);
    for (const a of ['install', 'api_key', 'signin', 'disconnect']) assert.ok(c.actions?.[a], a);
    const ints = m.integrations as unknown as Record<string, Record<string, string>>;
    for (const o of agentOptions()) {
      const p = ints[o.provider] ?? {};
      assert.ok(p.name && p.agent && p.howTo, o.provider);
      if (o.subscription === 'owner_only') assert.ok(p.ownerOnly, `${o.provider}.ownerOnly`);
    }
    assert.ok(typeof m.integrations.iHave === 'string', 'old keys keep working');
  }
});

test('every catalog app, group, state and action has its copy in es and en', async () => {
  const { CATALOG } = await import('@/lib/chalito/web/apps-catalog');
  assert.ok(CATALOG.length >= 25);
  assert.equal(new Set(CATALOG.map((a) => a.id)).size, CATALOG.length, 'unique ids');
  const states = ['not_installed', 'installing', 'needs_auth', 'signing_in', 'connected', 'error', 'blocked_by_policy', 'available'];
  const actions = ['api_key', 'signin', 'install', 'disconnect', 'launch'];
  for (const m of [es, en] as unknown as { connect: Record<string, Record<string, string>> }[]) {
    for (const g of ['agent', 'desktop', 'web']) {
      assert.ok(m.connect.groups![g], `groups.${g}`);
      assert.ok(m.connect.howTo![g], `howTo.${g}`);
    }
    for (const g of ['desktop', 'web']) assert.ok(m.connect.launchNote![g], `launchNote.${g}`);
    for (const st of states) assert.ok(m.connect.state![st], `state.${st}`);
    for (const a of actions) assert.ok(m.connect.actions![a], `actions.${a}`);
  }
  // Every app sorts into a group and agents that take a key name it.
  for (const a of CATALOG) {
    assert.ok(['agent', 'desktop', 'web'].includes(a.group), a.id);
    if (a.apiKey) assert.ok(a.apiKey.label && a.apiKey.docsUrl.startsWith('https://'), a.id);
  }
});
