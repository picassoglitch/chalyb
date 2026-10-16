import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, generateDeviceKeys, publicKeys, type ApiClient } from '@chalito/client-keys';
import { DeviceClientKeys } from '@chalito/client-keys';
import { fingerprint, randomNonce, verifyEnvelope } from '@chalito/crypto';
import { signGlyph } from '@chalito/glyph';
import type { GlyphPayload } from '@chalito/protocol';
import {
  HANDOFF_STASH_KEY,
  HANDOFF_STASH_TTL_MS,
  approveComputer,
  clearHandoff,
  codeIdFromHash,
  declineComputer,
  findByCode,
  findByLink,
  handoffCodeId,
  headedToApproval,
  stashHandoff,
  stashedHandoff,
} from '@/lib/chalito/web/approve-computer';
import es from '../src/lib/chalito/messages/es.json' with { type: 'json' };
import en from '../src/lib/chalito/messages/en.json' with { type: 'json' };

const NOW = 1_790_000_000_000;
const CODE = 'abcdefghijklmnopqrstuv'; // 22 chars, like a real 128-bit code id

const memStore = () => {
  const m = new Map<string, string>();
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
};

const fakeApi = (
  answer: (path: string, body: unknown) => unknown,
): ApiClient & { calls: [string, unknown][] } => {
  const calls: [string, unknown][] = [];
  return {
    calls,
    async post<T>(path: string, body: unknown): Promise<T> {
      calls.push([path, body]);
      return answer(path, body) as T;
    },
  };
};

const computer = async (codeId = CODE) => {
  const agent = await generateDeviceKeys();
  const pub = await publicKeys(agent);
  const glyph: GlyphPayload = await signGlyph(
    {
      v: 1,
      purpose: 'pair_device',
      codeId,
      issuerPubSign: pub.pubSign,
      issuerPubBox: pub.pubBox,
      label: 'MacBook de Ana',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 4 * 60_000,
      nonce: (await randomNonce()).slice(0, 22),
    },
    agent.sign.secretKey,
  );
  return { agent, glyph };
};

const view = (glyph: GlyphPayload, approval: 'one_tap' | 'code_required' = 'one_tap') => ({
  glyph,
  kind: 'laptop',
  platform: 'macos',
  expiresAt: glyph.body.expiresAt,
  network: approval === 'one_tap' ? 'same' : 'different',
  approval,
  city: null,
});

test('the link fragment: only a well-formed c= code id', () => {
  assert.equal(codeIdFromHash(`#c=${CODE}`), CODE);
  assert.equal(codeIdFromHash(`#x=1&c=${CODE}`), CODE);
  assert.equal(codeIdFromHash('#c=short'), null);
  assert.equal(codeIdFromHash('#c=bad/../id_0123456789'), null);
  assert.equal(codeIdFromHash(''), null);
});

test('stash: survives a sign-in round-trip in this tab, expires, and the fragment wins', () => {
  const s = memStore();
  assert.equal(stashHandoff(s, `#c=${CODE}`, NOW), CODE);
  assert.equal(stashedHandoff(s, NOW + 60_000), CODE);
  assert.equal(handoffCodeId(s, '', NOW + 60_000), CODE, 'no fragment after sign-in: the stash');
  const other = 'zyxwvutsrqponmlkjihgfe';
  assert.equal(handoffCodeId(s, `#c=${other}`, NOW + 60_000), other, 'a fresh fragment wins');
  assert.equal(stashedHandoff(s, NOW + 60_000 + HANDOFF_STASH_TTL_MS), null, 'too old');
  assert.equal(s.m.has(HANDOFF_STASH_KEY), false, 'a stale stash is dropped');
  stashHandoff(s, `#c=${CODE}`, NOW);
  clearHandoff(s);
  assert.equal(stashedHandoff(s, NOW), null);
  s.setItem(HANDOFF_STASH_KEY, '{"codeId":"x","at":1}');
  assert.equal(stashedHandoff(s, 2), null, 'a malformed stash is ignored');
  assert.equal(stashHandoff(s, '#nothing', NOW), null);
});

test('the sign-in page stashes only on the way to the approval screen', () => {
  assert.equal(headedToApproval('?next=/app/chalito/computadoras/aprobar'), true);
  assert.equal(headedToApproval('?next=%2Fen%2Fapp%2Fchalito%2Fcomputadoras%2Faprobar'), true);
  assert.equal(headedToApproval('?next=/app/billing'), false);
  assert.equal(headedToApproval('?next=/app/chalito/computadoras/aprobar/../../x'), false);
  assert.equal(headedToApproval(''), false);
});

test('findByLink: posts the code id, checks the glyph and that it is that code', async () => {
  const { glyph, agent } = await computer();
  const api = fakeApi(() => view(glyph, 'code_required'));
  const r = await findByLink(api, CODE, Date.now());
  assert.deepEqual(api.calls, [['/v1/pairing/handoff', { codeId: CODE }]]);
  assert.ok(r.ok);
  assert.equal(r.target.display.fingerprint, await fingerprint(agent.sign.publicKey));
  assert.equal(r.target.view.approval, 'code_required');

  const swapped = await computer('another_code_id_0123456');
  const bad = await findByLink(
    fakeApi(() => view(swapped.glyph)),
    CODE,
    Date.now(),
  );
  assert.deepEqual(bad, { ok: false, reason: 'tampered' });

  const gone = await findByLink(
    fakeApi(() => {
      throw new ApiError(404, 'not_found');
    }),
    CODE,
    Date.now(),
  );
  assert.deepEqual(gone, { ok: false, reason: 'not_found' });
});

test('findByCode: the typed code, normalised, through /resolve', async () => {
  const { glyph } = await computer();
  const api = fakeApi(() => view(glyph));
  const r = await findByCode(api, ' 7k3m qx9p ', Date.now());
  assert.ok(r.ok);
  assert.deepEqual(api.calls, [['/v1/pairing/resolve', { shortCode: '7K3M-QX9P' }]]);
  assert.deepEqual(await findByCode(api, 'nope', Date.now()), {
    ok: false,
    reason: 'invalid_code',
  });
});

const browserKeys = async () => DeviceClientKeys.create(await generateDeviceKeys());

test('approve: passkey first, signed claim, then this browser trusts the computer', async () => {
  const { glyph } = await computer();
  const keys = await browserKeys();
  const found = await findByLink(
    fakeApi(() => view(glyph)),
    CODE,
    Date.now(),
  );
  assert.ok(found.ok);
  const order: string[] = [];
  const api = fakeApi(
    (path) => (order.push(path), { ok: true, agentDeviceId: found.target.display.agentDeviceId }),
  );
  const r = await approveComputer(api, keys, found.target, {
    owner: 'user-1',
    now: Date.now(),
    userCheck: async () => void order.push('passkey'),
  });
  assert.deepEqual(r, { ok: true, name: 'MacBook de Ana' });
  assert.deepEqual(order, ['passkey', '/v1/pairing/claim']);
  const body = api.calls[0]![1] as {
    claim: Parameters<typeof verifyEnvelope>[0];
    shortCode?: string;
  };
  assert.equal(body.shortCode, undefined, 'one tap: no code sent');
  assert.equal((body.claim as { body: { codeId: string } }).body.codeId, CODE);
  assert.deepEqual(
    keys.trustedAgents().map((a) => a.deviceId),
    [found.target.display.agentDeviceId],
  );
});

test('approve from another network: sends the typed code; a wrong one says so; nothing trusted', async () => {
  const { glyph } = await computer();
  const keys = await browserKeys();
  const found = await findByLink(
    fakeApi(() => view(glyph, 'code_required')),
    CODE,
    Date.now(),
  );
  assert.ok(found.ok);
  const refused = fakeApi(() => {
    throw new ApiError(403, 'code_required');
  });
  const r = await approveComputer(refused, keys, found.target, {
    owner: 'u',
    now: Date.now(),
    shortCode: 'zzzz-zzzz',
  });
  assert.deepEqual(r, { ok: false, reason: 'wrong_code' });
  assert.equal((refused.calls[0]![1] as { shortCode: string }).shortCode, 'ZZZZ-ZZZZ');
  assert.deepEqual(keys.trustedAgents(), []);
  assert.deepEqual(
    await approveComputer(refused, keys, found.target, {
      owner: 'u',
      now: Date.now(),
      shortCode: 'x',
    }),
    {
      ok: false,
      reason: 'invalid_code',
    },
  );
});

test('a cancelled passkey prompt sends nothing', async () => {
  const { glyph } = await computer();
  const found = await findByLink(
    fakeApi(() => view(glyph)),
    CODE,
    Date.now(),
  );
  assert.ok(found.ok);
  const api = fakeApi(() => ({ ok: true }));
  const r = await approveComputer(api, await browserKeys(), found.target, {
    owner: 'u',
    now: Date.now(),
    userCheck: async () => {
      throw Object.assign(new Error('no'), { name: 'NotAllowedError' });
    },
  });
  assert.deepEqual(r, { ok: false, reason: 'step_up' });
  assert.equal(api.calls.length, 0);
});

test('decline: posts the code id; an already gone code counts as declined', async () => {
  const api = fakeApi(() => ({ ok: true }));
  assert.equal(await declineComputer(api, CODE), 'ok');
  assert.deepEqual(api.calls, [['/v1/pairing/decline', { codeId: CODE }]]);
  const gone = fakeApi(() => {
    throw new ApiError(404, 'not_found');
  });
  assert.equal(await declineComputer(gone, CODE), 'ok');
  const forbidden = fakeApi(() => {
    throw new ApiError(403, 'not_opened');
  });
  assert.equal(await declineComputer(forbidden, CODE), 'failed');
});

test('copy: the same keys in es and en, the phishing warning and the decline are there', () => {
  const keys = (o: unknown, p = ''): string[] =>
    Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
      typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`],
    );
  assert.deepEqual(keys(es.approveComputer).sort(), keys(en.approveComputer).sort());
  assert.match(es.approveComputer.phishing, /Si alguien te mandó este enlace, no lo apruebes/);
  assert.equal(es.approveComputer.notInFront, 'No estoy frente a esa computadora');
  assert.doesNotMatch(JSON.stringify(es.approveComputer), /glifo|anillo/);
});
