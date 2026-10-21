import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ApiError,
  DeviceClientKeys,
  generateDeviceKeys,
  publicKeys,
  type ApiClient,
} from '@chalito/client-keys';
import { fingerprint, randomNonce, signEnvelope } from '@chalito/crypto';
import { signGlyph } from '@chalito/glyph';
import type { GlyphPayload, PairingLoopbackProof } from '@chalito/protocol';
import {
  ApproveFlow,
  HANDOFF_STASH_KEY,
  HANDOFF_STASH_TTL_MS,
  approveComputer,
  askLoopback,
  clearHandoff,
  declineComputer,
  findByCode,
  findByLink,
  handoffFor,
  handoffFromHash,
  headedToApproval,
  onApprovalPage,
  pendingApproval,
  stashHandoff,
  stashedHandoff,
  stripHash,
  verifyLoopbackProof,
  type ApproveComputerApi,
  type ComputerTarget,
} from '@/lib/chalito/web/approve-computer';
import { withoutFragment } from '@/lib/analytics-url';
import es from '../src/lib/chalito/messages/es.json' with { type: 'json' };
import en from '../src/lib/chalito/messages/en.json' with { type: 'json' };

const NOW = 1_790_000_000_000;
const CODE = 'abcdefghijklmnopqrstuv'; // 22 chars, like a real 128-bit code id
const NONCE = 'N'.repeat(43);

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

const view = (
  glyph: GlyphPayload,
  o: {
    network?: 'same' | 'different';
    approval?: string;
    nonce?: string | null;
    typed?: boolean;
    city?: string;
  } = {},
) => ({
  glyph,
  kind: 'laptop',
  platform: 'macos',
  expiresAt: glyph.body.expiresAt,
  network: o.network ?? 'same',
  approval: o.approval ?? 'code_required',
  city: o.city ?? null,
  loopbackNonce: o.nonce === undefined ? NONCE : o.nonce,
  codeTyped: o.typed ?? false,
});

const proofFor = async (
  agent: Awaited<ReturnType<typeof computer>>['agent'],
  codeId = CODE,
  nonce = NONCE,
  o: { origin?: string; signerId?: string } = {},
) =>
  (await signEnvelope(
    'chalito.pairing-loopback.v1',
    { v: 1, codeId, nonce, origin: o.origin ?? 'https://www.chalyb.com', issuedAt: Date.now() },
    o.signerId ?? agent.deviceId,
    agent.sign.secretKey,
  )) as PairingLoopbackProof;

// ---- link, stash, fragment hygiene -------------------------------------------------------

test('the link fragment: a well-formed c= code id, and p= only for the agent loopback ports', () => {
  assert.deepEqual(handoffFromHash(`#c=${CODE}&p=47811`), { codeId: CODE, port: 47811 });
  assert.deepEqual(handoffFromHash(`#c=${CODE}&p=8080`), { codeId: CODE, port: null });
  assert.deepEqual(handoffFromHash(`#x=1&c=${CODE}`), { codeId: CODE, port: null });
  assert.equal(handoffFromHash('#c=short'), null);
  assert.equal(handoffFromHash('#c=bad/../id_0123456789'), null);
  assert.equal(handoffFromHash(''), null);
});

test('stash: survives sign-in in this tab for as long as a code lives, and the fragment wins', () => {
  assert.equal(HANDOFF_STASH_TTL_MS, 5 * 60_000);
  const s = memStore();
  assert.deepEqual(stashHandoff(s, `#c=${CODE}&p=47810`, NOW), { codeId: CODE, port: 47810 });
  assert.deepEqual(stashedHandoff(s, NOW + 60_000), { codeId: CODE, port: 47810 });
  assert.deepEqual(handoffFor(s, '', NOW + 60_000), { codeId: CODE, port: 47810 });
  const other = 'zyxwvutsrqponmlkjihgfe';
  assert.equal(handoffFor(s, `#c=${other}`, NOW + 60_000)?.codeId, other, 'a fresh fragment wins');
  assert.equal(pendingApproval(s, NOW + 60_000), true);
  assert.equal(stashedHandoff(s, NOW + 60_000 + HANDOFF_STASH_TTL_MS), null, 'too old');
  assert.equal(s.m.has(HANDOFF_STASH_KEY), false, 'a stale stash is dropped');
  assert.equal(pendingApproval(s, NOW), false);
  stashHandoff(s, `#c=${CODE}`, NOW);
  clearHandoff(s);
  assert.equal(stashedHandoff(s, NOW), null);
  s.setItem(HANDOFF_STASH_KEY, '{"codeId":"x","at":1}');
  assert.equal(stashedHandoff(s, 2), null, 'a malformed stash is ignored');
});

test('the sign-in page stashes only on the way to the approval screen', () => {
  assert.equal(headedToApproval('?next=/app/chalito/computadoras/aprobar'), true);
  assert.equal(headedToApproval('?next=%2Fen%2Fapp%2Fchalito%2Fcomputadoras%2Faprobar'), true);
  assert.equal(headedToApproval('?next=/app/billing'), false);
  assert.equal(headedToApproval('?next=/app/chalito/computadoras/aprobar/../../x'), false);
});

test('the fragment leaves the address bar, and analytics never sees one', () => {
  const calls: unknown[][] = [];
  const history = { state: { k: 1 }, replaceState: (...a: unknown[]) => void calls.push(a) };
  stripHash(
    { pathname: '/app/chalito/computadoras/aprobar', search: '?x=1', hash: `#c=${CODE}` },
    history,
  );
  assert.deepEqual(calls, [[{ k: 1 }, '', '/app/chalito/computadoras/aprobar?x=1']]);
  stripHash({ pathname: '/p', search: '', hash: '' }, history);
  assert.equal(calls.length, 1, 'nothing to strip');
  assert.deepEqual(
    withoutFragment({
      type: 'pageview',
      url: `https://www.chalyb.com/app/chalito/computadoras/aprobar#c=${CODE}&p=47810`,
    }),
    {
      type: 'pageview',
      url: 'https://www.chalyb.com/app/chalito/computadoras/aprobar',
    },
  );
  const banner = readFileSync('src/components/public/cookie-banner.tsx', 'utf8');
  assert.match(banner, /<Analytics beforeSend=\{withoutFragment\} \/>/);
  const stash = readFileSync('src/components/tools/chalito/HandoffStash.tsx', 'utf8');
  assert.match(stash, /stripHash\(window\.location, window\.history\)/);
  const page = readFileSync(
    'src/app/[locale]/(dashboard)/app/chalito/computadoras/aprobar/page.tsx',
    'utf8',
  );
  assert.ok(
    page.indexOf('<KeepApprovalLink />') < page.indexOf('<LiveGate'),
    'kept and stripped before the gate',
  );
});

test('the link leaves the address bar even while Chalito signs in or when that fails', () => {
  assert.equal(onApprovalPage('/app/chalito/computadoras/aprobar'), true);
  assert.equal(onApprovalPage('/en/app/chalito/computadoras/aprobar/'), true);
  assert.equal(onApprovalPage('/app/chalito/sesiones'), false, 'other screens keep their hash');
  const stash = readFileSync('src/components/tools/chalito/HandoffStash.tsx', 'utf8');
  assert.match(stash, /if \(!onApprovalPage\(window\.location\.pathname\)\) return;/);
  // HubBridge shows "Entrando…" or the sign-in error instead of the page: strip outside it.
  const layout = readFileSync('src/app/[locale]/(dashboard)/app/chalito/layout.tsx', 'utf8');
  const unlocked = layout.slice(layout.indexOf('tab="auto"'));
  assert.ok(unlocked.includes('<KeepApprovalLink />'));
  assert.ok(unlocked.indexOf('<KeepApprovalLink />') < unlocked.indexOf('<HubBridge>'));
  const locked = layout.slice(layout.indexOf('tab={null}'), layout.indexOf('tab="auto"'));
  assert.ok(locked.includes('<KeepApprovalLink />'), 'a plan without Chalito strips it too');
});

// ---- the loopback ------------------------------------------------------------------------

test('askLoopback: only with a port, only a proof for this code and nonce, quietly null otherwise', async () => {
  const { agent } = await computer();
  const good = await proofFor(agent);
  const asked: string[] = [];
  const answer = (body: unknown, ok = true) =>
    (async (url: string) => (
      asked.push(String(url)),
      { ok, json: async () => body }
    )) as unknown as typeof fetch;
  assert.deepEqual(
    await askLoopback(answer({ proof: good }), { codeId: CODE, port: 47810 }, NONCE),
    good,
  );
  assert.equal(asked[0], 'http://127.0.0.1:47810/pairing/proof');
  assert.equal(
    await askLoopback(answer({ proof: good }), { codeId: CODE, port: null }, NONCE),
    null,
  );
  assert.equal(
    await askLoopback(answer({ proof: good }), { codeId: CODE, port: 47810 }, 'M'.repeat(43)),
    null,
  );
  assert.equal(
    await askLoopback(answer({ proof: good }, false), { codeId: CODE, port: 47810 }, NONCE),
    null,
  );
  const down = (async () => {
    throw new TypeError('Failed to fetch');
  }) as unknown as typeof fetch;
  assert.equal(await askLoopback(down, { codeId: CODE, port: 47810 }, NONCE), null);
});

// ---- the api helpers -----------------------------------------------------------------------

test('findByLink / findByCode: check the glyph and the code id; map api errors', async () => {
  const { glyph, agent } = await computer();
  const r = await findByLink(
    fakeApi(() => view(glyph)),
    CODE,
    Date.now(),
  );
  assert.ok(r.ok);
  assert.equal(r.target.display.fingerprint, await fingerprint(agent.sign.publicKey));
  const swapped = await computer('another_code_id_0123456');
  assert.deepEqual(
    await findByLink(
      fakeApi(() => view(swapped.glyph)),
      CODE,
      Date.now(),
    ),
    { ok: false, reason: 'tampered' },
  );
  const gone = fakeApi(() => {
    throw new ApiError(404, 'not_found');
  });
  assert.deepEqual(await findByLink(gone, CODE, Date.now()), { ok: false, reason: 'not_found' });
  const api = fakeApi(() => view(glyph, { typed: true, nonce: null }));
  assert.ok((await findByCode(api, ' 7k3m qx9p ', Date.now())).ok);
  assert.deepEqual(api.calls, [['/v1/pairing/resolve', { shortCode: '7K3M-QX9P' }]]);
  assert.deepEqual(await findByCode(api, 'nope', Date.now()), {
    ok: false,
    reason: 'invalid_code',
  });
});

const browserKeys = async () => DeviceClientKeys.create(await generateDeviceKeys());

test('approve: passkey first, then the claim with the proof (or the typed code), then trust', async () => {
  const { glyph, agent } = await computer();
  const keys = await browserKeys();
  const found = await findByLink(
    fakeApi(() => view(glyph)),
    CODE,
    Date.now(),
  );
  assert.ok(found.ok);
  const order: string[] = [];
  const api = fakeApi((path) => (order.push(path), { ok: true }));
  const proof = await proofFor(agent);
  const r = await approveComputer(api, keys, found.target, {
    owner: 'user-1',
    now: Date.now(),
    loopbackProof: proof,
    userCheck: async () => void order.push('passkey'),
  });
  assert.deepEqual(r, { ok: true, name: 'MacBook de Ana', trusted: true });
  assert.deepEqual(order, ['passkey', '/v1/pairing/claim']);
  const body = api.calls[0]![1] as { shortCode?: string; loopbackProof?: unknown };
  assert.equal(body.shortCode, undefined);
  assert.deepEqual(body.loopbackProof, proof);
  assert.deepEqual(
    keys.trustedAgents().map((a) => a.deviceId),
    [found.target.display.agentDeviceId],
  );

  const refused = fakeApi(() => {
    throw new ApiError(403, 'code_required');
  });
  assert.deepEqual(
    await approveComputer(refused, await browserKeys(), found.target, {
      owner: 'u',
      now: Date.now(),
      shortCode: 'zzzz-zzzz',
    }),
    {
      ok: false,
      reason: 'wrong_code',
    },
  );
  assert.equal((refused.calls[0]![1] as { shortCode: string }).shortCode, 'ZZZZ-ZZZZ');
});

test('a claim that went through but could not be trusted locally is "paired, finish setup"', async () => {
  const { glyph } = await computer();
  const found = await findByLink(
    fakeApi(() => view(glyph)),
    CODE,
    Date.now(),
  );
  assert.ok(found.ok);
  const keys = {
    deviceId: (await browserKeys()).deviceId,
    sign: (await browserKeys()).sign.bind(await browserKeys()),
    trustAgentFromGlyph: async () => {
      throw new Error('vault locked');
    },
  };
  const r = await approveComputer(
    fakeApi(() => ({ ok: true })),
    keys as never,
    found.target,
    { owner: 'u', now: Date.now(), shortCode: '7K3M-QX9P' },
  );
  assert.deepEqual(r, { ok: true, name: 'MacBook de Ana', trusted: false });
});

test('decline: posts the code id; an already gone code counts as declined', async () => {
  const api = fakeApi(() => ({ ok: true }));
  assert.equal(await declineComputer(api, CODE), 'ok');
  assert.deepEqual(api.calls, [['/v1/pairing/decline', { codeId: CODE }]]);
  assert.equal(
    await declineComputer(
      fakeApi(() => {
        throw new ApiError(404, 'not_found');
      }),
      CODE,
    ),
    'ok',
  );
  assert.equal(
    await declineComputer(
      fakeApi(() => {
        throw new ApiError(403, 'not_opened');
      }),
      CODE,
    ),
    'failed',
  );
});

// ---- the screen (ApproveFlow; ApproveComputer.tsx renders its view) ---------------------

const flowWorld = async (o: {
  hash?: string;
  find?: (codeId: string) => Promise<unknown>;
  approve?: () => Promise<unknown>;
  decline?: () => Promise<'ok' | 'failed'>;
  proof?: boolean | 'forged' | 'wrong_signer' | 'wrong_origin';
  view?: Parameters<typeof view>[1];
  now?: () => number;
}) => {
  const { glyph, agent } = await computer();
  const target = async (v = o.view): Promise<ComputerTarget> => {
    const r = await findByLink(
      fakeApi(() => view(glyph, v)),
      CODE,
      Date.now(),
    );
    assert.ok(r.ok);
    return r.target;
  };
  const store = memStore();
  const stripped: string[] = [];
  const approvals: unknown[] = [];
  const api: ApproveComputerApi = {
    findByLink: async (codeId) =>
      (o.find ? o.find(codeId) : { ok: true, target: await target() }) as never,
    findByCode: async () => ({
      ok: true,
      target: await target({ ...o.view, typed: true, nonce: null }),
    }),
    approve: async (_t, x) => (
      approvals.push(x),
      (o.approve ? o.approve() : { ok: true, name: 'MacBook de Ana', trusted: true }) as never
    ),
    decline: o.decline ?? (async () => 'ok'),
    fingerprint: async () => 'ab12 cd34',
  };
  const impostor = await generateDeviceKeys();
  const proof =
    o.proof === true
      ? await proofFor(agent)
      : o.proof === 'forged'
        ? // Claims to be this computer, signed by another key.
          await proofFor(impostor as never, CODE, NONCE, { signerId: agent.deviceId })
        : o.proof === 'wrong_signer'
          ? // Validly signed, but by another agent.
            await proofFor(impostor as never)
          : o.proof === 'wrong_origin'
            ? await proofFor(agent, CODE, NONCE, { origin: 'https://evil.example' })
            : null;
  const asked: unknown[] = [];
  const flow = new ApproveFlow({
    api,
    store,
    location: {
      pathname: '/app/chalito/computadoras/aprobar',
      search: '',
      hash: o.hash ?? `#c=${CODE}&p=47810`,
      origin: 'https://www.chalyb.com',
    },
    history: { replaceState: (_s, _t, url) => void stripped.push(String(url)) },
    loopback: async (h, nonce) => (asked.push([h, nonce]), proof),
    now: o.now ?? Date.now,
  });
  return { flow, store, stripped, approvals, asked, proof };
};

test('flow: link + loopback proof = one tap, no warning, no code; the proof goes to the claim', async () => {
  const w = await flowWorld({ proof: true });
  await w.flow.start();
  assert.deepEqual(w.stripped, ['/app/chalito/computadoras/aprobar'], 'fragment stripped at once');
  assert.deepEqual(w.asked, [[{ codeId: CODE, port: 47810 }, NONCE]]);
  const v = w.flow.view;
  assert.equal(v.s, 'confirm');
  assert.ok(v.s === 'confirm' && v.sameComputer && !v.warn && !v.needsCode);
  await w.flow.approve();
  assert.deepEqual(w.approvals, [{ loopbackProof: w.proof }]);
  assert.deepEqual(w.flow.view, {
    s: 'done',
    name: 'MacBook de Ana',
    fingerprint: 'ab12 cd34',
    trusted: true,
  });
  assert.equal(w.store.m.has(HANDOFF_STASH_KEY), false, 'stash cleared after approving');
});

for (const bad of ['forged', 'wrong_signer', 'wrong_origin'] as const)
  test(`flow: a loopback answer that doesn't verify (${bad}) keeps the warning and the code`, async () => {
    const w = await flowWorld({ proof: bad });
    await w.flow.start();
    const v = w.flow.view;
    assert.ok(v.s === 'confirm' && !v.sameComputer && v.warn && v.needsCode, bad);
    w.flow.setTyped('7K3M-QX9P');
    await w.flow.approve();
    assert.deepEqual(
      w.approvals,
      [{ shortCode: '7K3M-QX9P' }],
      'the unverified answer is never sent',
    );
  });

test("verifyLoopbackProof: this computer's key and id, this code, nonce and origin", async () => {
  const { glyph, agent } = await computer();
  const found = await findByLink(
    fakeApi(() => view(glyph)),
    CODE,
    Date.now(),
  );
  assert.ok(found.ok);
  const o = { nonce: NONCE, origin: 'https://www.chalyb.com' };
  assert.equal(await verifyLoopbackProof(await proofFor(agent), found.target, o), true);
  const other = await generateDeviceKeys();
  assert.equal(await verifyLoopbackProof(await proofFor(other as never), found.target, o), false);
  assert.equal(
    await verifyLoopbackProof(
      await proofFor(other as never, CODE, NONCE, { signerId: agent.deviceId }),
      found.target,
      o,
    ),
    false,
  );
  assert.equal(
    await verifyLoopbackProof(await proofFor(agent), found.target, {
      ...o,
      origin: 'http://localhost:3000',
    }),
    false,
  );
  assert.equal(
    await verifyLoopbackProof(await proofFor(agent), found.target, { ...o, nonce: 'M'.repeat(43) }),
    false,
  );
  assert.equal(
    await verifyLoopbackProof(await proofFor(agent, 'another_code_id_0123456'), found.target, o),
    false,
  );
});

test('flow: link without a proof (other device, blocked loopback) = warning and the typed code', async () => {
  const w = await flowWorld({ proof: false, view: { network: 'different', city: 'Guadalajara' } });
  await w.flow.start();
  const v = w.flow.view;
  assert.ok(v.s === 'confirm' && !v.sameComputer && v.warn && v.needsCode && !v.blocked);
  w.flow.setTyped('7k3m-qx9p');
  await w.flow.approve();
  assert.deepEqual(w.approvals, [{ shortCode: '7k3m-qx9p' }]);
});

test('flow: same public network still warns without the proof (IP is not proof)', async () => {
  const w = await flowWorld({ proof: false, view: { network: 'same' } });
  await w.flow.start();
  const v = w.flow.view;
  assert.ok(v.s === 'confirm' && v.warn && v.needsCode);
});

test('flow: a wrong code or a refused proof stays on the screen, asking for the code', async () => {
  const w = await flowWorld({
    proof: true,
    approve: async () => ({ ok: false, reason: 'proof_failed' }),
  });
  await w.flow.start();
  await w.flow.approve();
  const v = w.flow.view;
  assert.ok(
    v.s === 'confirm' && v.error === 'proof_failed' && v.needsCode && v.warn && !v.sameComputer,
  );
});

test('flow: a phone that scanned the colour code gets the in-front-of-it warning, not the link one', async () => {
  const w = await flowWorld({ hash: '' });
  await w.flow.start();
  const { glyph } = await computer();
  await w.flow.findGlyph(glyph);
  const v = w.flow.view;
  assert.ok(v.s === 'confirm' && v.warn && v.warnSource === 'scan' && v.needsCode);
  const link = await flowWorld({ proof: false });
  await link.flow.start();
  assert.ok(link.flow.view.s === 'confirm' && link.flow.view.warnSource === 'link');
  const src = readFileSync('src/components/tools/chalito/ApproveComputer.tsx', 'utf8');
  assert.match(src, /view\.warnSource === "scan" \? t\("phishingScan"\) : t\("phishing"\)/);
  assert.match(es.approveComputer.phishingScan, /Aprueba solo si tienes esa computadora enfrente/);
  assert.doesNotMatch(es.approveComputer.phishingScan, /enlace/);
});

test('flow: decline cancels and clears the stash', async () => {
  const w = await flowWorld({});
  await w.flow.start();
  assert.equal(w.store.m.has(HANDOFF_STASH_KEY), true);
  await w.flow.decline();
  assert.deepEqual(w.flow.view, { s: 'declined' });
  assert.equal(w.store.m.has(HANDOFF_STASH_KEY), false);
});

test('flow: blocked (the policy alternative) offers only the decline', async () => {
  const w = await flowWorld({ view: { approval: 'blocked' } });
  await w.flow.start();
  const v = w.flow.view;
  assert.ok(v.s === 'confirm' && v.blocked && !v.needsCode);
  await w.flow.approve();
  assert.deepEqual(w.approvals, [], 'approve does nothing when blocked');
});

test('flow: an expired code clears the stash and says so', async () => {
  let t = Date.now();
  const w = await flowWorld({ now: () => t });
  await w.flow.start();
  t += 10 * 60_000;
  await w.flow.approve();
  assert.deepEqual(w.flow.view, { s: 'input', busy: false, error: 'expired' });
  assert.deepEqual(w.approvals, []);
  assert.equal(w.store.m.has(HANDOFF_STASH_KEY), false);
});

test('flow: a code that is gone (not_found) clears the stash', async () => {
  const w = await flowWorld({ find: async () => ({ ok: false, reason: 'not_found' }) });
  await w.flow.start();
  assert.deepEqual(w.flow.view, { s: 'input', busy: false, error: 'not_found' });
  assert.equal(w.store.m.has(HANDOFF_STASH_KEY), false);
});

test('flow: no link = type the code; a typed code needs nothing more at the claim', async () => {
  const w = await flowWorld({ hash: '' });
  await w.flow.start();
  assert.deepEqual(w.flow.view, { s: 'input', busy: false, error: null });
  await w.flow.findCode('7K3M-QX9P');
  const v = w.flow.view;
  assert.ok(v.s === 'confirm' && !v.warn && !v.needsCode, 'typing the code here was the proof');
  await w.flow.approve();
  assert.deepEqual(w.approvals, [{}]);
});

test('flow: paired but not trusted locally shows "finish setup", not failed', async () => {
  const w = await flowWorld({
    proof: true,
    approve: async () => ({ ok: true, name: 'MacBook de Ana', trusted: false }),
  });
  await w.flow.start();
  await w.flow.approve();
  assert.deepEqual(w.flow.view, {
    s: 'done',
    name: 'MacBook de Ana',
    fingerprint: 'ab12 cd34',
    trusted: false,
  });
});

test('the screen renders every state of the flow, with the decline wherever there is a warning', () => {
  const src = readFileSync('src/components/tools/chalito/ApproveComputer.tsx', 'utf8');
  for (const s of ['"loading"', '"done"', '"declined"', '"confirm"'])
    assert.ok(src.includes(`view.s === ${s}`), s);
  assert.match(src, /data-testid="approve-decline"/);
  assert.match(
    src,
    /view\.warn \? "ch-btn ch-btn--danger"/,
    'the decline is prominent under a warning',
  );
  assert.match(src, /!view\.blocked \?[\s\S]*approve-approve/, 'no approve button when blocked');
  assert.match(src, /view\.trusted \? t\("done"/);
  const endorse = readFileSync('src/components/tools/chalito/EndorseWait.tsx', 'utf8');
  assert.match(
    endorse,
    /pendingApproval\(sessionOrNull\(\), Date\.now\(\)\)[\s\S]*\/computadoras\/aprobar/,
  );
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
  for (const e of ['proof_failed', 'not_found', 'expired', 'wrong_code', 'code_required'])
    assert.ok((es.approveComputer.error as Record<string, string>)[e], e);
});
