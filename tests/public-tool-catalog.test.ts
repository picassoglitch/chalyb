import test from 'node:test';
import assert from 'node:assert/strict';
import { planFeatures } from '@/lib/billing/plan-features';
import { readActiveTools } from '@/lib/tools/public-tools';

test('public catalog: an explicitly empty or inactive catalog advertises no tools', async () => {
  const unexpectedError = () => assert.fail('a successful read must not report an outage');
  assert.deepEqual(await readActiveTools(async () => [], unexpectedError), []);
  assert.deepEqual(
    await readActiveTools(
      async () => [
        { slug: 'chalybclip', status: 'coming_soon' },
        { slug: 'chalybobs', status: 'paused' },
        { slug: 'chalybcrypto', status: 'active' },
      ],
      unexpectedError,
    ),
    [],
    'inactive marketed tools and active tools outside the public scope stay hidden',
  );
});

test('public catalog: a failed read reports the outage without claiming availability', async () => {
  const failure = new Error('catalog read failed');
  const reported: unknown[] = [];
  assert.deepEqual(
    await readActiveTools(
      async () => {
        throw failure;
      },
      (err) => reported.push(err),
    ),
    [],
  );
  assert.deepEqual(reported, [failure]);
});

test('public catalog: null data is reported as an outage, not an empty catalog', async () => {
  const reported: unknown[] = [];
  assert.deepEqual(
    await readActiveTools(
      async () => null,
      (err) => reported.push(err),
    ),
    [],
  );
  assert.equal(reported.length, 1);
});

test('public catalog: single-tool and both-active catalogs list exactly those, in display order', async () => {
  const noOutage = () => assert.fail('a successful read must not report an outage');
  const slugsFor = async (rows: { slug: string; status: string }[]) =>
    (await readActiveTools(async () => rows, noOutage)).map((tool) => tool.slug);
  assert.deepEqual(
    await slugsFor([
      { slug: 'chalybobs', status: 'active' },
      { slug: 'chalybclip', status: 'active' },
    ]),
    ['chalybclip', 'chalybobs'],
  );
  assert.deepEqual(
    await slugsFor([
      { slug: 'chalybclip', status: 'active' },
      { slug: 'chalybobs', status: 'paused' },
    ]),
    ['chalybclip'],
  );
});

test('public catalog: recovery advertises only the tools actually active in the next read', async () => {
  let unavailable = true;
  const read = async () => {
    if (unavailable) throw new Error('temporary outage');
    return [
      { slug: 'chalybobs', status: 'active' },
      { slug: 'chalybclip', status: 'paused' },
    ];
  };
  assert.deepEqual(await readActiveTools(read, () => {}), []);
  unavailable = false;
  assert.deepEqual(
    (await readActiveTools(read, () => {})).map((tool) => tool.slug),
    ['chalybobs'],
  );
});

test('public catalog: an En vivo-only plan does not promise Clips benefits', () => {
  const clipBenefits = new Set([
    'clipsTry',
    'clipsTryWatermark',
    'noWatermarkHd',
    'clips4k',
    'noStreams',
    'streams',
    'streamsUnlimited',
  ]);
  for (const tier of ['FREE', 'PRO', 'VIP'] as const) {
    const features = planFeatures(tier, {
      freeIncludesClips: true,
      clipLimitsEnforced: true,
      clipsActive: false,
    });
    assert.ok(features.length > 0, 'generic plan benefits remain');
    assert.ok(
      features.every((feature) => !clipBenefits.has(feature.key)),
      tier,
    );
  }
});
