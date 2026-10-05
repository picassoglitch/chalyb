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
  reserveWithMargin,
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

test('a fully spent allowance never costs more than the plan earns ÷ (1 + margin)', async () => {
  const { USAGE_ECONOMICS } = await import('@/lib/billing/tiers');
  const { planPrice, ivaPortion } = await import('@/config/pricing');
  const DEFAULT_USAGE_MARGIN_PERCENT = USAGE_ECONOMICS.defaultMarginPercent;
  // Cheapest monthly revenue per tier, before IVA, in USD at a weak peso.
  const monthlyUsd = (key: 'pro_month' | 'pro_year' | 'vip_month') => {
    const p = planPrice(key);
    const net = p.totalCents - ivaPortion(p.totalCents);
    return net / 100 / (p.interval === 'year' ? 12 : 1) / USAGE_ECONOMICS.conservativeMxnPerUsd;
  };
  const cases = [
    { tier: 'PRO' as const, revenue: Math.min(monthlyUsd('pro_month'), monthlyUsd('pro_year')) },
    { tier: 'VIP' as const, revenue: monthlyUsd('vip_month') },
  ];
  for (const { tier, revenue } of cases) {
    const billedUsd = (TIER_CAPS[tier].tokensPerMonth / 1e6) * USAGE_ECONOMICS.usdPerMillionBillable;
    const costUsd = billedUsd / (1 + DEFAULT_USAGE_MARGIN_PERCENT / 100);
    assert.ok(billedUsd <= revenue, `${tier}: allowance billed at $${billedUsd} exceeds $${revenue.toFixed(2)}/mo`);
    assert.ok(revenue >= costUsd * 2.6 - 1e-9, `${tier}: under 160% over cost`);
  }
});

test('the margin default is 160% everywhere', async () => {
  const { USAGE_ECONOMICS } = await import('@/lib/billing/tiers');
  const { readFileSync } = await import('node:fs');
  const settings = readFileSync('src/lib/config/settings.ts', 'utf8');
  const sql = readFileSync('supabase/migrations/0049_usage_margin_160.sql', 'utf8');
  assert.match(settings, /DEFAULT_USAGE_MARGIN_PERCENT = 160;/);
  assert.match(sql, /\n    160\)\n/);
  assert.equal(USAGE_ECONOMICS.defaultMarginPercent, 160);
});

test('reservations hold the estimate plus the margin', () => {
  assert.equal(reserveWithMargin(22_612, 160), 58_792);
  assert.equal(reserveWithMargin(1000, 0), 1000);
  assert.equal(reserveWithMargin(1000, -5), 1000);
});

test('a store purchase reserves its price, nothing on top', () => {
  assert.equal(reserveWithMargin(1200, 160, 'store.purchase'), 1200);
  assert.equal(reserveWithMargin(1200, 160, 'clips.pipeline'), 3120);
});

test('reconciliation: cents strings → micros, per model and workspace', async () => {
  const { sumCostReport, reconcileByModel, centsToMicros } = await import('@/lib/usage/reconciliation-core');
  assert.equal(centsToMicros('123.45'), 1_234_500); // $1.2345
  const billed = sumCostReport([
    { data: [{ starting_at: 'a', ending_at: 'b', results: [
      { amount: '100', currency: 'USD', model: 'claude-haiku-4-5', workspace_id: null, cost_type: 'tokens' },
      { amount: '50.5', currency: 'USD', model: 'claude-opus-5-5', workspace_id: 'wrkspc_x', cost_type: 'tokens' },
      { amount: '7', currency: 'USD', model: null, workspace_id: null, cost_type: 'web_search' },
    ] }] },
  ]);
  assert.equal(billed.totalMicros, 1_575_000);
  assert.equal(billed.byModel.get('web_search'), 70_000);
  assert.equal(billed.byWorkspace.get('wrkspc_x'), 505_000);
  const rows = reconcileByModel(new Map([['claude-haiku-4-5-20251001', 900_000]]), billed.byModel);
  const haiku = rows.find((r) => r.model === 'claude-haiku-4-5')!;
  assert.equal(haiku.recordedMicros, 900_000);
  assert.equal(haiku.gapPct, 10); // billed $1.00, recorded $0.90 → 10% under-recorded
});
