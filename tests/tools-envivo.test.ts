// En vivo (WS-11, TOOLS-SPEC §6): pure helpers and the mock engine contract.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MASKED_KEY,
  clipNowState,
  codeExpired,
  detectOs,
  formatDuration,
  formatElapsed,
  maskKey,
  otherOs,
  recentSignIn,
  REVEAL_MAX_ATTEMPTS,
  REVEAL_WINDOW_MS,
  revealAttemptAllowed,
  sessionAuthTimeMs,
  splitCode,
} from '@/lib/tools/envivo-core';
import { createMockEnVivo } from '@/lib/tools/adapters/mock-tools';

test('download button: Mac for macOS, Windows otherwise (iPhone is not a Mac)', () => {
  assert.equal(detectOs('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit'), 'mac');
  assert.equal(detectOs('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'windows');
  assert.equal(detectOs('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), 'windows');
  assert.equal(detectOs('Mozilla/5.0 (X11; Linux x86_64)'), 'windows');
  assert.equal(detectOs(null), 'windows');
  assert.equal(otherOs('windows'), 'mac');
  assert.equal(otherOs('mac'), 'windows');
});

test('live counter is always hh:mm:ss and never negative', () => {
  const since = '2026-10-03T10:00:00.000Z';
  const at = (s: number) => Date.parse(since) + s * 1000;
  assert.equal(formatElapsed(since, at(0)), '00:00:00');
  assert.equal(formatElapsed(since, at(754)), '00:12:34');
  assert.equal(formatElapsed(since, at(3600 * 2 + 5)), '02:00:05');
  assert.equal(formatElapsed(since, at(-30)), '00:00:00');
});

test('"Duró {duracion}" reads naturally', () => {
  assert.equal(formatDuration(42), '42 s');
  assert.equal(formatDuration(12 * 60 + 20), '12 min');
  assert.equal(formatDuration(3600), '1 h');
  assert.equal(formatDuration(3600 + 5 * 60), '1 h 5 min');
});

test('pairing code: 10 minutes, two groups of three', () => {
  const exp = '2026-10-03T10:10:00.000Z';
  assert.equal(codeExpired(exp, Date.parse(exp) - 1), false);
  assert.equal(codeExpired(exp, Date.parse(exp)), true);
  assert.deepEqual(splitCode('482913'), ['482', '913']);
  assert.deepEqual(splitCode('48 29-13'), ['482', '913']);
});

test('the stream key is masked the same way whatever it is', () => {
  assert.equal(maskKey(), MASKED_KEY);
  assert.equal(MASKED_KEY, '••••••••');
});

test('"Hacer clip de este momento" only while live and recording', () => {
  assert.equal(clipNowState({ live: false, saveRecording: true }), 'offAir');
  assert.equal(clipNowState({ live: true, saveRecording: false }), 'needsRecording');
  assert.equal(clipNowState({ live: true, saveRecording: true }), 'ready');
});

test('"Mostrar" needs THIS session to be under 5 minutes old (or the password)', () => {
  const now = Date.parse('2026-10-03T10:00:00.000Z');
  const jwt = (claims: object) =>
    `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;
  const sec = (iso: string) => Date.parse(iso) / 1000;
  // amr (the session's sign-in timestamps) wins over iat, which moves on
  // every token refresh.
  const fresh = jwt({
    iat: sec('2026-10-03T09:59:00Z'),
    amr: [{ method: 'password', timestamp: sec('2026-10-03T09:57:00Z') }],
  });
  const refreshed = jwt({
    iat: sec('2026-10-03T09:59:30Z'),
    amr: [{ method: 'otp', timestamp: sec('2026-10-03T08:00:00Z') }],
  });
  assert.equal(recentSignIn(sessionAuthTimeMs(fresh), now), true);
  assert.equal(
    recentSignIn(sessionAuthTimeMs(refreshed), now),
    false,
    'a refreshed token is not a sign-in',
  );
  // No amr: no proof of a recent sign-in, whatever iat says.
  assert.equal(sessionAuthTimeMs(jwt({ iat: sec('2026-10-03T09:58:00Z') })), null);
  assert.equal(sessionAuthTimeMs('not-a-jwt'), null);
  assert.equal(sessionAuthTimeMs(null), null);
  assert.equal(recentSignIn(null, now), false);
  assert.equal(recentSignIn(now + 60_000, now), false, 'not from the future');
});

test('"Mostrar" password checks are rate limited per user', () => {
  assert.equal(REVEAL_MAX_ATTEMPTS, 5);
  assert.equal(REVEAL_WINDOW_MS, 15 * 60_000);
  assert.ok(revealAttemptAllowed(0));
  assert.ok(revealAttemptAllowed(4));
  assert.ok(!revealAttemptAllowed(5));
});

test('mock engine: no computer until the code is typed, then paired and online', async () => {
  let t = Date.parse('2026-10-03T10:00:00.000Z');
  const a = createMockEnVivo(() => t);
  const before = await a.status('u1');
  assert.equal(before.paired, false);
  assert.equal(before.obsConnected, false);
  const code = await a.createPairingCode('u1');
  assert.match(code.code, /^\d{6}$/);
  assert.equal(Date.parse(code.expiresAt) - t, 10 * 60_000);
  t += 3000;
  const after = await a.status('u1');
  assert.equal(after.paired, true);
  assert.equal(after.obsConnected, true);
  assert.equal((await a.devices('u1')).length, 1);
  assert.equal((await a.status('u2')).paired, false, 'per user');
});

test('mock engine: an expired code pairs nothing', async () => {
  let t = Date.parse('2026-10-03T10:00:00.000Z');
  const a = createMockEnVivo(() => t);
  await a.createPairingCode('u1');
  t += 11 * 60_000;
  assert.equal((await a.status('u1')).paired, false);
});

test('mock engine: a stream ends up in Mis transmisiones; settings never carry the key', async () => {
  let t = Date.parse('2026-10-03T10:00:00.000Z');
  const a = createMockEnVivo(() => t);
  await a.start('u1');
  assert.equal((await a.status('u1')).viewers !== null, true);
  assert.deepEqual(await a.clipMoment('u1', 60), {
    sourceUrl: 'https://www.youtube.com/watch?v=mocklive&t=60',
  });
  t += 754_000;
  await a.stop('u1');
  const [st] = await a.streams('u1');
  assert.equal(st!.durationSec, 754);
  assert.equal(await a.clipMoment('u1', 60), null, 'nothing to clip off air');
  const key = await a.streamKey('u1', 'youtube');
  assert.ok(!JSON.stringify(await a.settings('u1')).includes(key));
});

test('mock engine: only a connected platform can be switched on', async () => {
  const a = createMockEnVivo();
  let s = await a.saveSettings('u1', { enabled: { kick: true, youtube: false } });
  assert.equal(s.destinations.find((d) => d.platform === 'kick')!.enabled, false);
  assert.equal(s.destinations.find((d) => d.platform === 'youtube')!.enabled, false);
  s = await a.connectDestination('u1', 'kick');
  assert.equal(s.destinations.find((d) => d.platform === 'kick')!.enabled, true);
  assert.deepEqual((await a.status('u1')).platforms, ['Twitch', 'Kick']);
});
