import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DeviceClientKeys,
  generateDeviceKeys,
  newAccountAgents,
  publicKeys,
  type DirectoryDevice,
} from '@chalito/client-keys';
import { signInFallback } from '@/lib/chalito/web/activate';
import es from '../src/lib/chalito/messages/es.json' with { type: 'json' };
import en from '../src/lib/chalito/messages/en.json' with { type: 'json' };

// ADR 0032 (picassoglitch/chalito): signing in approves every browser; what's left is one tap.

const NOW = 1_790_000_000_000;

const agent = async () => {
  const keys = await generateDeviceKeys();
  const pub = await publicKeys(keys);
  return { keys, ...pub, deviceId: keys.deviceId };
};
const row = (a: Awaited<ReturnType<typeof agent>>, over: Partial<DirectoryDevice> = {}): DirectoryDevice => ({
  deviceId: a.deviceId,
  role: 'agent',
  revoked: false,
  pubSign: a.pubSign,
  pubBox: a.pubBox,
  ...over,
});

test('sign-in fallback: one tap to approve again; the old screens only for an api without the route', () => {
  for (const blocked of ['rejected', 'failed', 'revoked', null] as const)
    assert.deepEqual(signInFallback(true, blocked), { approve: true, legacy: false }, String(blocked));
  assert.deepEqual(signInFallback(true, 'unsupported'), { approve: false, legacy: true });
  // A device session without keys (not the person's): neither; only a new hub sign-in helps.
  assert.deepEqual(signInFallback(false, 'failed'), { approve: false, legacy: false });
});

test('on connect: only computers new to this browser; the directory never replaces a known one\'s keys', async () => {
  const [desk, laptop, tower, attacker] = await Promise.all([agent(), agent(), agent(), agent()]);
  const keys = await DeviceClientKeys.create(desk.keys);
  await keys.trustIntroducedAgents(await newAccountAgents([row(laptop)], keys.trustedAgents()), 'sign_in', NOW);
  // Later the directory swaps the laptop's box key and lists a new tower.
  const added = await newAccountAgents([row(laptop, { pubBox: attacker.pubBox }), row(tower)], keys.trustedAgents());
  assert.deepEqual(added.map((a) => a.deviceId), [tower.deviceId]);
  await keys.trustIntroducedAgents(added, 'sign_in', NOW);
  assert.equal(keys.trustedAgents().find((a) => a.deviceId === laptop.deviceId)?.pubBox, laptop.pubBox);
  // Revoked rows and clients are never trusted as computers.
  const gone = await agent();
  assert.deepEqual(await newAccountAgents([row(gone, { revoked: true }), row(gone, { role: 'client' })], []), []);
});

test('approve this browser: es and en have the same strings, and every reason has text', () => {
  const g = (m: typeof es) => (m as { live: { gate: { approve: Record<string, unknown> } } }).live.gate.approve;
  assert.deepEqual(Object.keys(g(es)).sort(), Object.keys(g(en)).sort());
  for (const m of [es, en])
    for (const r of ['revoked', 'rejected', 'failed'])
      assert.ok((g(m).reason as Record<string, string>)[r], r);
});
