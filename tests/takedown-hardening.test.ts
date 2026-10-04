// Takedown hardening (7a review of #49): re-upload fingerprints that can't be
// dodged by rewriting the link (MED 5), the public endpoint's limits and
// evidence (MED 6), and the clips "more links" that are blocked (LOW).

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentFingerprint, normalizeContentUrl } from '@/lib/legal/takedown';
import { checkSourceUrl } from '@/lib/tools/adapters/run-job';
import {
  clientIp,
  handleTakedownPost,
  hashIp,
  readBodyCapped,
  TAKEDOWN_MAX_BYTES,
} from '@/lib/legal/takedown-http';
import { planClipLinks } from '@/lib/tools/clips-links';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// ---------- MED 5 · one fingerprint per video, however the link is written ----------

const YT = 'youtube.com/watch?v=dQw4w9WgXcQ';

const SAME: [string, string[]][] = [
  [
    YT,
    [
      'https://youtu.be/dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ?si=abc&t=42',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RDAMVM&feature=share',
      'https://gaming.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://m.youtube.com/watch?app=desktop&v=dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      'https://www.youtube.com/v/dQw4w9WgXcQ',
      'https://www.youtube.com/e/dQw4w9WgXcQ',
      'https://youtube.com/shorts/dQw4w9WgXcQ?feature=share',
      'https://www.youtube.com/live/dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ%20',
      'https://www.youtube.com/watch?v=%20dQw4w9WgXcQ',
      'https://www.youtube.com/watch?feature=youtu.be&v=dQw4w9WgXcQ#t=10',
      'https://YOUTUBE.com/WATCH?v=dQw4w9WgXcQ',
    ],
  ],
  [
    'kick.com/somechannel?clip=clip_01ABC',
    [
      'https://kick.com/somechannel?clip=clip_01ABC',
      'https://kick.com/somechannel?clip=clip_01ABC&ref=share&utm_source=x',
      'https://www.kick.com/SomeChannel?clip=clip_01ABC',
    ],
  ],
  [
    'facebook.com/watch?v=1234567890',
    [
      'https://www.facebook.com/watch?v=1234567890',
      'https://www.facebook.com/watch/?v=1234567890&mibextid=abc&ref=sharing',
      'https://m.facebook.com/watch?v=1234567890&rdid=x&share_url=y',
    ],
  ],
  [
    'twitch.tv/videos/123',
    [
      'https://www.twitch.tv/videos/123',
      'https://www.twitch.tv/videos/123?filter=archives&sort=time',
      'https://www.twitch.tv/Videos/123/',
      'https://m.twitch.tv/videos/123?t=1h2m',
    ],
  ],
];

for (const [canonical, variants] of SAME)
  test(`MED 5 · every way of writing ${canonical} is the same content`, () => {
    for (const v of variants) assert.equal(normalizeContentUrl(v), canonical, v);
    assert.equal(new Set(variants.map(contentFingerprint)).size, 1);
  });

test('MED 5 · different content stays different', () => {
  const fp = contentFingerprint;
  assert.notEqual(fp('https://youtu.be/dQw4w9WgXcQ'), fp('https://youtu.be/aaaaaaaaaaa'));
  // YouTube ids are case-sensitive.
  assert.notEqual(fp('https://youtu.be/dQw4w9WgXcQ'), fp('https://youtu.be/DQW4W9WGXCQ'));
  assert.notEqual(
    fp('https://kick.com/somechannel?clip=clip_01ABC'),
    fp('https://kick.com/somechannel?clip=clip_02XYZ'),
  );
  // A Twitch clip slug is case-sensitive; the channel isn't.
  assert.equal(
    normalizeContentUrl('https://www.twitch.tv/SomeOne/clip/FunnyClipSlug-abc'),
    'twitch.tv/someone/clip/FunnyClipSlug-abc',
  );
  assert.equal(
    normalizeContentUrl('https://clips.twitch.tv/FunnyClipSlug-abc?tt_medium=x'),
    'clips.twitch.tv/FunnyClipSlug-abc',
  );
  assert.equal(normalizeContentUrl('https://fb.watch/AbC123/?mibextid=x'), 'fb.watch/AbC123');
  assert.equal(contentFingerprint('no es un enlace'), null);
  assert.equal(contentFingerprint('javascript:alert(1)'), null);
});

test('MED 5 · every YouTube link the upload accepts maps to the same fingerprint', () => {
  for (const v of SAME[0]![1]) {
    const checked = checkSourceUrl(v);
    if (!checked.ok) continue; // the upload refuses it, so it can't dodge the block
    assert.equal(normalizeContentUrl(checked.url), YT, `upload ${v} → ${checked.url}`);
  }
});

// ---------- MED 6 · the public endpoint: byte cap, rate limits, evidence ----------

const NOTICE = {
  claimantName: 'Titular',
  claimantContact: 'Titular@Example.com ',
  contentIdentification: 'Mi canción',
  rightStatement: 'Soy el autor',
  contentLocation: 'https://youtu.be/dQw4w9WgXcQ',
};

function req(body: string | ReadableStream<Uint8Array>, headers: Record<string, string> = {}) {
  return new Request('https://www.chalyb.com/api/legal/takedown', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json', ...headers },
    // A stream body needs half-duplex in Node's fetch.
    ...(typeof body === 'string' ? {} : { duplex: 'half' }),
  } as RequestInit);
}

/** A chunked body that never says how long it is (no content-length). */
function chunked(total: number, chunk = 8_192): ReadableStream<Uint8Array> {
  let sent = 0;
  return new ReadableStream({
    pull(c) {
      if (sent >= total) return c.close();
      const n = Math.min(chunk, total - sent);
      sent += n;
      c.enqueue(new Uint8Array(n).fill(0x61));
    },
  });
}

function deps(limits: Record<string, boolean> = {}) {
  const calls = { rate: [] as string[], submitted: [] as unknown[] };
  return {
    calls,
    d: {
      rateLimit: async (key: string) => {
        calls.rate.push(key);
        return limits[key] ?? true;
      },
      submit: async (input: unknown, evidence: unknown) => {
        calls.submitted.push({ input, evidence });
        return { ok: true as const, id: 'n1' };
      },
    },
  };
}

test('MED 6 · a chunked body past the cap is cut, whatever content-length says', async () => {
  assert.equal(
    await readBodyCapped(req(chunked(TAKEDOWN_MAX_BYTES + 1)), TAKEDOWN_MAX_BYTES),
    null,
  );
  assert.equal((await readBodyCapped(req('{"a":1}'), TAKEDOWN_MAX_BYTES))!, '{"a":1}');
  const { d, calls } = deps();
  const lying = req(chunked(TAKEDOWN_MAX_BYTES * 4), { 'content-length': '10' });
  const r = await handleTakedownPost(lying, d);
  assert.equal(r.status, 413);
  assert.equal(calls.submitted.length, 0);
});

test('MED 6 · rate limited per IP and per claimant contact', async () => {
  const ip = { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' };
  {
    const { d, calls } = deps();
    const r = await handleTakedownPost(req(JSON.stringify(NOTICE), ip), d);
    assert.equal(r.status, 200);
    assert.deepEqual(calls.rate, [
      'takedown:ip:203.0.113.7',
      'takedown:contact:titular@example.com',
    ]);
  }
  for (const blocked of ['takedown:ip:203.0.113.7', 'takedown:contact:titular@example.com']) {
    const { d, calls } = deps({ [blocked]: false });
    const r = await handleTakedownPost(req(JSON.stringify(NOTICE), ip), d);
    assert.equal(r.status, 429, blocked);
    assert.equal((r.body as { code: string }).code, 'rateLimited');
    assert.equal(calls.submitted.length, 0, blocked);
  }
  // A form with a missing field doesn't use up the claimant's attempts.
  const { d, calls } = deps();
  const r = await handleTakedownPost(req(JSON.stringify({ ...NOTICE, rightStatement: '' }), ip), d);
  assert.equal(r.status, 422);
  assert.deepEqual(calls.rate, []);
});

test('MED 6 · the notice stores a hashed IP and the user agent as evidence', async () => {
  const { d, calls } = deps();
  await handleTakedownPost(
    req(JSON.stringify(NOTICE), { 'x-forwarded-for': '203.0.113.7', 'user-agent': 'UA/1.0' }),
    d,
  );
  const { evidence } = calls.submitted[0] as { evidence: { ipHash: string; userAgent: string } };
  assert.equal(evidence.userAgent, 'UA/1.0');
  assert.match(evidence.ipHash, /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(calls.submitted).includes('203.0.113.7'), 'the raw IP is never stored');
  assert.equal(
    evidence.ipHash,
    createHmac('sha256', 'chalyb-dev-takedown-evidence').update('203.0.113.7').digest('hex'),
    'outside production, the dev key',
  );
});

test('LOW · the IP hash is an HMAC with LEGAL_EVIDENCE_HASH_KEY; prod without it stores none', () => {
  const key = 'k'.repeat(32);
  const h = hashIp('203.0.113.7', { LEGAL_EVIDENCE_HASH_KEY: key, VERCEL_ENV: 'production' });
  assert.equal(h, createHmac('sha256', key).update('203.0.113.7').digest('hex'));
  assert.match(h!, /^[0-9a-f]{64}$/, 'migration 0059 CHECK (hex-64)');
  assert.notEqual(h, createHash('sha256').update('203.0.113.7').digest('hex'));
  assert.equal(hashIp('203.0.113.7', { VERCEL_ENV: 'production' }), null, 'fail closed');
  assert.equal(hashIp(null, { LEGAL_EVIDENCE_HASH_KEY: key }), null);
});

test('LOW · the IP comes from x-vercel-forwarded-for, then x-real-ip, then x-forwarded-for', () => {
  const h = (o: Record<string, string>) => new Headers(o);
  assert.equal(
    clientIp(
      h({
        'x-vercel-forwarded-for': '198.51.100.1',
        'x-real-ip': '198.51.100.2',
        'x-forwarded-for': '6.6.6.6, 198.51.100.3',
      }),
    ),
    '198.51.100.1',
  );
  assert.equal(
    clientIp(h({ 'x-real-ip': '198.51.100.2', 'x-forwarded-for': '6.6.6.6' })),
    '198.51.100.2',
  );
  assert.equal(clientIp(h({ 'x-forwarded-for': '198.51.100.3, 10.0.0.1' })), '198.51.100.3');
  assert.equal(clientIp(h({})), null);
});

test('MED 6 · the route uses the handler with the durable limiter; migration 0059 adds the columns', () => {
  const route = readFileSync(join(ROOT, 'src/app/api/legal/takedown/route.ts'), 'utf8');
  assert.match(route, /handleTakedownPost\(/);
  assert.match(route, /check_contact_rate_limit/);
  const sql = readFileSync(join(ROOT, 'supabase/migrations/0059_takedown_evidence.sql'), 'utf8');
  assert.match(sql, /add column if not exists claimant_ip_hash text/);
  assert.match(sql, /add column if not exists claimant_user_agent text/);
});

// ---------- LOW · a blocked "more links" URL is reported, not skipped ----------

test('LOW · a blocked extra link stops the batch with the blocked message', async () => {
  const blocked = new Set([contentFingerprint('https://youtu.be/BLOCKEDvid1')]);
  const isBlocked = async (u: string) => blocked.has(contentFingerprint(u));
  const main = 'https://youtu.be/dQw4w9WgXcQ';

  const ok = await planClipLinks(
    main,
    'https://youtu.be/aaaaaaaaaaa https://example.com/x',
    isBlocked,
  );
  assert.deepEqual(ok.ok && ok.links.map((l) => normalizeContentUrl(l)), [
    YT,
    'youtube.com/watch?v=aaaaaaaaaaa',
  ]); // the unsupported extra is still skipped, as before

  // Blocked among the extras — however it's written — or as the main link.
  for (const extra of [
    'https://youtu.be/BLOCKEDvid1',
    'https://music.youtube.com/watch?v=BLOCKEDvid1&si=x',
  ])
    assert.deepEqual(
      await planClipLinks(main, `https://youtu.be/aaaaaaaaaaa ${extra}`, isBlocked),
      {
        ok: false,
        reason: 'content_blocked',
      },
    );
  assert.deepEqual(await planClipLinks('https://youtu.be/BLOCKEDvid1', '', isBlocked), {
    ok: false,
    reason: 'content_blocked',
  });
  assert.deepEqual(await planClipLinks('nope', '', isBlocked), {
    ok: false,
    reason: 'link_unsupported',
  });

  const action = readFileSync(join(ROOT, 'src/lib/tools/clips-actions.ts'), 'utf8');
  assert.match(action, /planClipLinks\(/);
  assert.doesNotMatch(action, /if \(!extra\.ok\) continue;/);
});
