// Takedown hardening (7a review of #49): re-upload fingerprints that can't be
// dodged by rewriting the link (MED 5), the public endpoint's limits and
// evidence (MED 6), and the clips "more links" that are blocked (LOW).

import test from 'node:test';
import assert from 'node:assert/strict';
import { contentFingerprint, normalizeContentUrl } from '@/lib/legal/takedown';
import { checkSourceUrl } from '@/lib/tools/adapters/run-job';

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
