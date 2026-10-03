// Consumption caps: what an engine may run, on which lane, and which usage
// events the hub accepts. The atomic counting (concurrency, monthly caps,
// tokens) is covered against Postgres in scripts/test-migrations.mjs.

import test from 'node:test';
import assert from 'node:assert/strict';
import { BOOST_FEE_TOKENS, TIER_CAPS } from '@/lib/billing/tiers';
import {
  checkItemCaps,
  parseAdmitBody,
  publicLimits,
  resolveLane,
  sqlCaps,
  type AdmitRequest,
} from '@/lib/usage/admission-core';
import { MAX_EVENTS_PER_REQUEST, validateUsageEvents } from '@/lib/usage/event-validation';

function req(over: Partial<AdmitRequest> = {}): AdmitRequest {
  return {
    externalJobId: 'job_1',
    class: 'job',
    operation: 'clips.pipeline',
    estTokens: 1000,
    uploadMb: 0,
    sourceMinutes: 0,
    storageMbAfter: null,
    boost: null,
    ttlSeconds: 3600,
    ...over,
  };
}

test('caps climb with the tier', () => {
  const order = ['FREE', 'PRO', 'VIP'] as const;
  for (const key of [
    'maxUploadMB',
    'maxSourceMinutes',
    'sourceMinutesPerMonth',
    'maxConcurrentJobs',
  ] as const) {
    for (let i = 1; i < order.length; i++) {
      assert.ok(
        TIER_CAPS[order[i]!][key] >= TIER_CAPS[order[i - 1]!][key],
        `${key}: ${order[i]} must not be below ${order[i - 1]}`,
      );
    }
  }
});

test('per-item caps refuse oversize uploads, long videos and full storage', () => {
  const free = TIER_CAPS.FREE;
  assert.equal(
    checkItemCaps(req({ uploadMb: free.maxUploadMB + 1 }), free, false),
    'upload_too_large',
  );
  assert.equal(
    checkItemCaps(req({ sourceMinutes: free.maxSourceMinutes + 0.5 }), free, false),
    'video_too_long',
  );
  assert.equal(
    checkItemCaps(req({ storageMbAfter: free.storageMB + 1 }), free, false),
    'storage_full',
  );
  assert.equal(
    checkItemCaps(
      req({ uploadMb: free.maxUploadMB, sourceMinutes: free.maxSourceMinutes }),
      free,
      false,
    ),
    null,
  );
});

test('admins skip per-item caps', () => {
  assert.equal(checkItemCaps(req({ uploadMb: 1e6 }), TIER_CAPS.FREE, true), null);
});

test('VIP boosts by default and pays no fee', () => {
  assert.deepEqual(resolveLane(req(), TIER_CAPS.VIP, false), { lane: 'boost', feeTokens: 0 });
});

test('VIP can still opt out of boost', () => {
  assert.deepEqual(resolveLane(req({ boost: false }), TIER_CAPS.VIP, false), {
    lane: 'standard',
    feeTokens: 0,
  });
});

test('other tiers boost only when they ask, and pay the fee', () => {
  for (const tier of ['FREE', 'PRO', 'PARTNER'] as const) {
    assert.deepEqual(resolveLane(req(), TIER_CAPS[tier], false), {
      lane: 'standard',
      feeTokens: 0,
    });
    assert.deepEqual(resolveLane(req({ boost: true }), TIER_CAPS[tier], false), {
      lane: 'boost',
      feeTokens: BOOST_FEE_TOKENS,
    });
  }
});

test('streams never take the boost lane', () => {
  assert.deepEqual(resolveLane(req({ class: 'stream', boost: true }), TIER_CAPS.VIP, false), {
    lane: 'standard',
    feeTokens: 0,
  });
});

test('Infinity caps go to SQL and engines as -1 (uncapped)', () => {
  const c = sqlCaps(TIER_CAPS.VIP, TIER_CAPS.VIP.tokensPerMonth, false);
  assert.equal(c.streams_per_month, -1);
  assert.equal(publicLimits(TIER_CAPS.VIP).boost_fee_tokens, 0);
  assert.equal(publicLimits(TIER_CAPS.PRO).boost_fee_tokens, BOOST_FEE_TOKENS);
});

test('admit body: valid input parses with defaults', () => {
  const r = parseAdmitBody({ external_job_id: 'stream_9', est_tokens: 12.2, upload_mb: 80 });
  assert.ok(typeof r !== 'string');
  assert.equal(r.class, 'job');
  assert.equal(r.estTokens, 13);
  assert.equal(r.boost, null);
  assert.equal(r.ttlSeconds, 3 * 60 * 60);
});

test('admit body: bad input is refused', () => {
  assert.equal(typeof parseAdmitBody({}), 'string');
  assert.equal(typeof parseAdmitBody({ external_job_id: 'a b' }), 'string');
  assert.equal(typeof parseAdmitBody({ external_job_id: 'j', est_tokens: -1 }), 'string');
  assert.equal(typeof parseAdmitBody({ external_job_id: 'j', class: 'batch' }), 'string');
  assert.equal(typeof parseAdmitBody({ external_job_id: 'j', boost: 'yes' }), 'string');
  assert.equal(typeof parseAdmitBody({ external_job_id: 'j', ttl_seconds: 10 }), 'string');
});

const NOW = Date.parse('2026-10-03T12:00:00Z');
const ok = { kind: 'llm.tokens', amount: 1200, source_id: 'llmc_1', cost_usd_micros: 9000 };

test('usage events: a clean event is accepted and keeps its reservation', () => {
  const r = validateUsageEvents(
    [
      {
        ...ok,
        reservation_id: '0b9a5f1e-8a8e-4c55-9f3b-5d5f1c0f6a11',
        occurred_at: '2026-10-03T11:00:00Z',
      },
    ],
    NOW,
  );
  assert.ok(r.ok);
  assert.equal(r.events[0]!.costUsdMicros, 9000);
  assert.equal(r.events[0]!.reservationId, '0b9a5f1e-8a8e-4c55-9f3b-5d5f1c0f6a11');
});

test('usage events: batch size is bounded', () => {
  const r = validateUsageEvents(
    Array.from({ length: MAX_EVENTS_PER_REQUEST + 1 }, (_, i) => ({ ...ok, source_id: `s${i}` })),
    NOW,
  );
  assert.ok(!r.ok);
  assert.equal(r.status, 413);
});

test('usage events: amounts and costs must be sane integers', () => {
  for (const bad of [
    { amount: 1.5 },
    { amount: 1e13 },
    { cost_usd_micros: -1 },
    { cost_usd_micros: 2e9 },
  ]) {
    const r = validateUsageEvents([{ ...ok, ...bad }], NOW);
    assert.ok(!r.ok, JSON.stringify(bad));
    assert.equal(r.status, 422);
  }
});

test('usage events: no backdating out of the period, no future dates', () => {
  const old = validateUsageEvents([{ ...ok, occurred_at: '2026-09-20T00:00:00Z' }], NOW);
  const future = validateUsageEvents([{ ...ok, occurred_at: '2026-10-03T13:00:00Z' }], NOW);
  assert.ok(!old.ok && old.status === 422);
  assert.ok(!future.ok && future.status === 422);
});

test('usage events: missing occurred_at is stamped with now', () => {
  const r = validateUsageEvents([ok], NOW);
  assert.ok(r.ok);
  assert.equal(r.events[0]!.occurredAt, new Date(NOW).toISOString());
});

test('usage events: malformed fields are 400, with the failing index', () => {
  const r = validateUsageEvents([ok, { ...ok, kind: 'LLM Tokens' }], NOW);
  assert.ok(!r.ok);
  assert.equal(r.status, 400);
  assert.equal(r.index, 1);
});
