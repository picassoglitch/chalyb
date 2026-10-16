// Señales inside the hub, mode "a": the hub API token, the engine adapter's
// mapping and error handling, the registry switch, Mercado/Estrategias input
// rules and the usage-refusal path through the BFF error.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { signHubApiToken, hubApiAudience } from '@/lib/engines/hub-api-token';
import {
  createEngineCaller,
  createEngineSenales,
  engineError,
  notConfigured,
  toSignal,
  HUB_SERVICE_PRINCIPAL,
  EngineHttpError,
  validEngineBase,
} from '@/lib/tools/adapters/senales-engine';
import { createMockSenales } from '@/lib/tools/adapters/mock-tools';
import {
  failureEffect,
  normalizeToolError,
  statusForReason,
  countsAsOutage,
  usageReasonOf,
  ToolUsageRefusedError,
  markAdapterError,
} from '@/lib/tools/bff-core';
import {
  baseOf,
  bookTop,
  depthWidths,
  parseInterval,
  parsePair,
  parseVenue,
  usageRefusalKind,
  validateBacktest,
  extent,
  scale,
} from '@/lib/tools/senales-market-core';
import { runsInHub } from '@/lib/tools/hub-runs';
import { toolHubMode } from '@/lib/config/flags';
import { PERSONAL_FINANCE_FIELDS } from '@/lib/guardrails/signals';

const SECRET = 'test-shared-sso-secret-must-be-long-enough-32b';
const USER = 'aaaaaaaa-0000-4000-8000-000000000001';

function decode(token: string) {
  const [body, sig] = token.split('.');
  return {
    claims: JSON.parse(Buffer.from(body!, 'base64url').toString()),
    sigOk: createHmac('sha256', SECRET).update(body!).digest('base64url') === sig,
  };
}

// ── token ─────────────────────────────────────────────────────────────
test('hub API token: launch-token format + aud, short lifetime, engine secret', () => {
  process.env.CHALYBCRYPTO_SSO_SECRET = SECRET;
  const now = 1_790_000_000_000;
  const tok = signHubApiToken('chalybcrypto', { userId: USER }, now);
  const { claims, sigOk } = decode(tok);
  assert.ok(sigOk);
  assert.equal(tok.split('.').length, 2);
  assert.deepEqual(claims, {
    user_id: USER,
    email: '',
    tenant_id: '',
    tier: '',
    exp: now / 1000 + 120,
    aud: 'chalybcrypto-hub-api',
  });
  assert.equal(hubApiAudience('chalybcrypto'), 'chalybcrypto-hub-api');
});

test('hub API token: no secret, no token (fails closed)', () => {
  const prev = process.env.CHALYBCRYPTO_SSO_SECRET;
  delete process.env.CHALYBCRYPTO_SSO_SECRET;
  assert.throws(() => signHubApiToken('chalybcrypto', { userId: USER }), /SSO_SECRET/);
  process.env.CHALYBCRYPTO_SSO_SECRET = prev;
});

// ── base URL ──────────────────────────────────────────────────────────
test('engine base: https only (http just for localhost), origin only', () => {
  assert.equal(
    validEngineBase('https://chalybcrypto.chalyb.com/x?y'),
    'https://chalybcrypto.chalyb.com',
  );
  assert.equal(validEngineBase('http://127.0.0.1:8000'), 'http://127.0.0.1:8000');
  assert.equal(validEngineBase('http://evil.example.com'), null);
  assert.equal(validEngineBase('javascript:alert(1)'), null);
  assert.equal(validEngineBase(''), null);
  assert.equal(validEngineBase(undefined), null);
});

// ── caller + adapter against a fake engine ────────────────────────────
type Seen = { url: URL; init: RequestInit };

function fakeEngine(handler: (url: URL, init: RequestInit) => { status: number; body: unknown }) {
  const seen: Seen[] = [];
  const fetchImpl = (async (input: URL | string, init: RequestInit = {}) => {
    const url = new URL(String(input));
    seen.push({ url, init });
    const r = handler(url, init);
    return new Response(JSON.stringify(r.body), {
      status: r.status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  const call = createEngineCaller(async () => 'https://engine.test', fetchImpl);
  return { seen, adapter: createEngineSenales(call) };
}

test('every engine call carries a fresh hub Bearer for the user, under /api/hub/v1', async () => {
  process.env.CHALYBCRYPTO_SSO_SECRET = SECRET;
  const { seen, adapter } = fakeEngine(() => ({ status: 200, body: [] }));
  await adapter.strategies(USER);
  assert.equal(seen[0]!.url.href, 'https://engine.test/api/hub/v1/strategies');
  const auth = (seen[0]!.init.headers as Record<string, string>).Authorization!;
  assert.match(auth, /^Bearer /);
  const { claims, sigOk } = decode(auth.slice(7));
  assert.ok(sigOk);
  assert.equal(claims.user_id, USER);
  assert.equal(claims.aud, 'chalybcrypto-hub-api');
  assert.equal(seen[0]!.init.redirect, 'error');
});

test('prefs round-trip through the engine (PUT then GET)', async () => {
  process.env.CHALYBCRYPTO_SSO_SECRET = SECRET;
  let stored: unknown = null;
  const { seen, adapter } = fakeEngine((url, init) => {
    if (init.method === 'PUT') {
      stored = JSON.parse(String(init.body));
      return { status: 200, body: stored };
    }
    return { status: 200, body: stored };
  });
  assert.equal(await adapter.getPrefs(USER), null);
  const prefs = {
    coins: ['BTC'],
    channels: ['app' as const],
    timeframe: 'day' as const,
    quietHours: true,
  };
  await adapter.savePrefs(USER, prefs);
  assert.deepEqual(await adapter.getPrefs(USER), prefs);
  assert.equal(seen[1]!.url.pathname, '/api/hub/v1/signal-prefs');
  assert.equal(seen[1]!.init.method, 'PUT');
});

test('signal content is the shared feed, fetched as the service principal (never a user)', async () => {
  process.env.CHALYBCRYPTO_SSO_SECRET = SECRET;
  const ID = '3f2b8a7e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
  const entry = (coin: string, over: Record<string, unknown> = {}) => ({
    id: coin === 'BTC' ? ID : `${ID.slice(0, -3)}${coin.length}00`,
    coin,
    state: 'buy',
    confidence: 'medium',
    explanation: '2 de 3 estrategias de Señales coinciden en esta lectura.',
    at: '2026-10-16T05:00:00+00:00',
    ref_price_mxn: 1510135.34,
    why: { short: 'Las lecturas del precio apuntan hacia arriba.', bullets: ['a', 'b', 'c', 'd'] },
    ...over,
  });
  const { seen, adapter } = fakeEngine((url) => {
    if (url.pathname === '/api/hub/v1/feed')
      return {
        status: 200,
        body: {
          signals: [
            entry('BTC'),
            entry('SOL', { ref_price_mxn: null }),
            entry('X', { state: 'moon' }),
          ],
        },
      };
    if (url.pathname === `/api/hub/v1/feed/${ID}`)
      return {
        status: 200,
        body: {
          signal: entry('BTC'),
          series: [{ at: '2026-10-16T00:00:00+00:00', price_mxn: 1.5 }],
        },
      };
    return { status: 404, body: { detail: 'feed entry not found' } };
  });
  const all = await adapter.getSignals({ plan: 'PRO' });
  assert.deepEqual(
    all.map((x) => x.coin),
    ['BTC', 'SOL'],
  ); // malformed entries are dropped
  assert.equal(all[0]!.refPriceMXN, 1510135.34);
  assert.equal('refPriceMXN' in all[1]!, false); // no rate → no invented price
  assert.equal(all[0]!.why!.bullets.length, 3);
  assert.equal(seen[0]!.url.searchParams.get('plan'), 'PRO');
  const sub = decode(
    ((seen[0]!.init.headers as Record<string, string>).Authorization ?? '').slice(7),
  ).claims;
  assert.equal(sub.user_id, HUB_SERVICE_PRINCIPAL);
  assert.deepEqual(
    (await adapter.getSignals({ plan: 'VIP', coins: ['SOL'] })).map((x) => x.coin),
    ['SOL'],
  );
  const one = await adapter.getSignal({ plan: 'PRO', id: ID, range: '1m' });
  assert.equal(one!.signal.id, ID);
  assert.deepEqual(one!.series, [{ at: '2026-10-16T00:00:00+00:00', priceMXN: 1.5 }]);
  assert.equal(seen.at(-1)!.url.searchParams.get('range'), '1m');
  const before = seen.length;
  assert.equal(await adapter.getSignal({ plan: 'PRO', id: '../x', range: '7d' }), null);
  assert.equal(seen.length, before); // a junk id never reaches the engine
  assert.equal(
    await adapter.getSignal({
      plan: 'PRO',
      id: '00000000-0000-4000-8000-000000000000',
      range: '7d',
    }),
    null,
  );
  assert.deepEqual(await adapter.channels(), ['app']);
});

test('feed mapping drops bad states and keeps only 3 bullets', () => {
  assert.equal(toSignal({ id: 'a', coin: 'BTC', state: 'buy', confidence: 'nope' }), null);
  assert.equal(toSignal({ coin: 'BTC', state: 'buy', confidence: 'high' }), null);
});

test('engine wire → hub shapes (markets, indicators, order book, derivatives, news, backtest)', async () => {
  process.env.CHALYBCRYPTO_SSO_SECRET = SECRET;
  const { adapter } = fakeEngine((url) => {
    const p = url.pathname.replace('/api/hub/v1', '');
    if (p === '/markets')
      return {
        status: 200,
        body: {
          venues: [
            { id: 'bitunix', name: 'Bitunix', live: true, data_only: false, note: 'x' },
            { id: 'nope', name: 'Nope' },
            { id: 'binance', name: 'Binance', data_only: true },
          ],
          symbols: [{ symbol: 'BTCUSDT', base: 'BTC', quote: 'USDT', max_leverage: 125 }],
          error: null,
        },
      };
    if (p === '/indicators/BTCUSDT')
      return {
        status: 200,
        body: {
          candles: [{ time: 1, open: 1, high: 2, low: 0.5, close: 1.5 }],
          rsi: [{ time: 1, value: 55 }],
          macd: { line: [], signal: [], hist: [] },
          adx: [],
          volume_delta: [{ time: 1, value: -3 }],
        },
      };
    if (p === '/orderbook/BTCUSDT')
      return {
        status: 200,
        body: {
          pair: 'BTCUSDT',
          taken_at: '2026-10-15T00:00:00Z',
          is_native: true,
          bids: [{ price: 99, size: 1, cumulative: 1 }],
          asks: [{ price: 101, size: 2, cumulative: 2 }],
        },
      };
    if (p === '/coinglass/BTCUSDT')
      return {
        status: 200,
        body: {
          symbol: 'BTC',
          interval: '1h',
          oi: [{ time: 1, value: 5 }],
          funding: [],
          liquidations: [{ time: 1, long_usd: 3, short_usd: 4 }],
          long_short: [{ time: 1, long_pct: 52, short_pct: 48 }],
          heatmap: [{ price: 100, amount_usd: 9 }],
        },
      };
    if (p === '/news')
      return {
        status: 200,
        body: {
          items: [
            { published_at: 'a', title: 't', url: 'https://n.example/1', source: 's' },
            { published_at: 'a', title: 'bad', url: 'javascript:alert(1)', source: 's' },
          ],
        },
      };
    if (p === '/backtests')
      return {
        status: 200,
        body: {
          job_id: 'backtest_1',
          status: 'done',
          strategy: 'fvg_ob',
          pair: 'BTCUSDT',
          timeframe: '5m',
          bars_requested: 1500,
          bars: 1500,
          data_source: 'bitunix',
          from: '2026-10-11T00:00:00+00:00',
          to: '2026-10-16T00:00:00+00:00',
          optimistic: true,
          starting_equity: 10000,
          ending_equity: 10120,
          net_return_bps: 120,
          metrics: {
            sample_size: 12,
            win_rate: 0.5,
            avg_win_bps: 40,
            avg_loss_bps: 30,
            profit_factor: null,
            avg_rr: null,
            max_drawdown_bps: 80,
            fee_drag_bps: 12,
          },
          assumptions: {
            risk_per_trade_bps: 50,
            lookback_bars: 300,
            maker_bps: 2,
            taker_bps: 6,
            spread_bps: 1,
            slippage_bps: 1,
            funding_per_8h: 0.0001,
          },
          created_at: '2026-10-16T05:00:00+00:00',
        },
      };
    return { status: 404, body: { detail: 'Not Found' } };
  });
  const m = await adapter.markets(USER, 'bitunix');
  assert.deepEqual(
    m.venues.map((v) => v.id),
    ['bitunix', 'binance'],
  );
  assert.deepEqual(m.symbols, [{ symbol: 'BTCUSDT', base: 'BTC', quote: 'USDT' }]);
  assert.equal(m.degraded, false);
  const ind = await adapter.indicators(USER, { pair: 'BTCUSDT', interval: '5m', bars: 300 });
  assert.deepEqual(ind.volumeDelta, [{ time: 1, value: -3 }]);
  const ob = await adapter.orderBook(USER, 'BTCUSDT');
  assert.deepEqual(bookTop(ob), { mid: 100, spreadBps: 200 });
  const d = await adapter.derivatives(USER, { pair: 'BTCUSDT', interval: '1h' });
  assert.deepEqual(d!.liquidations, [{ time: 1, longUsd: 3, shortUsd: 4 }]);
  assert.deepEqual(d!.heatmap, [{ price: 100, amountUsd: 9 }]);
  const news = await adapter.news(USER, 'BTC');
  assert.deepEqual(
    news!.map((n) => n.url),
    ['https://n.example/1'],
  );
  const bt = await adapter.runBacktest(USER, {
    strategy: 'fvg_ob',
    pair: 'BTCUSDT',
    timeframe: '5m',
    bars: 1500,
  });
  assert.equal(bt.jobId, 'backtest_1');
  assert.equal(bt.status, 'done');
  assert.equal(bt.optimistic, true);
  assert.equal(bt.netReturnBps, 120);
  assert.equal(bt.metrics!.profitFactor, null);
  assert.equal(bt.metrics!.sampleSize, 12);
  assert.equal(bt.dataSource, 'bitunix');
  // No reservation ids or lanes leak to the screen.
  assert.equal('reservation_id' in bt || 'lane' in bt, false);
});

test('a data source without an API key reads as "not connected", any other 503 is an error', async () => {
  process.env.CHALYBCRYPTO_SSO_SECRET = SECRET;
  const off = fakeEngine(() => ({
    status: 503,
    body: { detail: { error: 'coinglass_api_key_missing' } },
  }));
  assert.equal(await off.adapter.derivatives(USER, { pair: 'BTCUSDT', interval: '1h' }), null);
  const offNews = fakeEngine(() => ({
    status: 503,
    body: { detail: { error: 'cryptopanic_api_key_missing' } },
  }));
  assert.equal(await offNews.adapter.news(USER, 'BTC'), null);
  const down = fakeEngine(() => ({ status: 503, body: { detail: 'Service Unavailable' } }));
  await assert.rejects(down.adapter.news(USER, 'BTC'), EngineHttpError);
  await assert.rejects(Promise.resolve(notConfigured(new Error('x'))));
});

test('engine errors map to BFF reasons; usage refusals keep their reason and are no outage', async () => {
  for (const [status, reason] of [
    [402, 'no_tokens'],
    [429, 'jobs_cap'],
    [413, 'storage_full'],
  ] as const) {
    const e = engineError(status, { detail: { error: 'usage_refused', reason, balance: 0 } });
    assert.ok(e instanceof ToolUsageRefusedError);
    const marked = markAdapterError(e);
    assert.equal(usageReasonOf(marked), reason);
    const eff = failureEffect(marked, { adapterErrorsOnly: true });
    assert.deepEqual(eff, { reason: 'usage_refused', retryable: false, outage: false });
  }
  assert.equal(statusForReason('usage_refused'), 402);
  assert.equal(countsAsOutage('usage_refused'), false);
  assert.equal(normalizeToolError(engineError(404, {})).reason, 'not_found');
  assert.equal(normalizeToolError(engineError(422, {})).reason, 'bad_request');
  for (const s of [401, 403, 500, 502, 503])
    assert.equal(
      failureEffect(markAdapterError(engineError(s, {})), { adapterErrorsOnly: true }).outage,
      true,
    );
  // A backtest whose price source failed: the person's state, not an outage.
  const nd = failureEffect(
    markAdapterError(engineError(502, { detail: { error: 'backtest_data_unavailable' } })),
    { adapterErrorsOnly: true },
  );
  assert.deepEqual(nd, { reason: 'no_data', retryable: false, outage: false });
  // A 402 that isn't a usage refusal is not mistaken for one.
  assert.equal(usageReasonOf(engineError(402, { detail: 'x' })), undefined);
  // Junk reasons never reach the screen.
  assert.equal(usageReasonOf(new ToolUsageRefusedError('<script>')), undefined);
  // The engine's text never travels: messages are ours.
  assert.doesNotMatch(String(engineError(500, { detail: 'secret stack' })), /secret stack/);
});

test('the backtest refusal flows from the adapter error into the BFF route answer', () => {
  const e = markAdapterError(new ToolUsageRefusedError('concurrency'));
  assert.equal(normalizeToolError(e).reason, 'usage_refused');
  assert.equal(usageRefusalKind(usageReasonOf(e)), 'busy');
});

// ── registry ──────────────────────────────────────────────────────────
test('mode "a" runs Señales (and En vivo) in the hub with engine adapters; off hands off; others stay stubs', () => {
  const env = process.env as Record<string, string | undefined>;
  const prev = { ...env };
  env.NODE_ENV = 'development';
  const hub = (slug: string) => runsInHub(slug, toolHubMode(slug));
  env.TOOL_HUB_MODE_CHALYBCRYPTO = 'a';
  env.TOOL_HUB_MODE_CHALYBOBS = 'a';
  env.TOOL_HUB_MODE_CHALYBBOT = 'a';
  assert.equal(hub('chalybcrypto'), true);
  assert.equal(hub('chalybobs'), true); // En vivo's engine adapter
  assert.equal(hub('chalybbot'), false); // still a stub
  env.TOOL_HUB_MODE_CHALYBCRYPTO = 'off';
  assert.equal(hub('chalybcrypto'), false);
  env.TOOL_HUB_MODE_CHALYBCRYPTO = 'on';
  assert.equal(hub('chalybcrypto'), true);
  for (const k of Object.keys(env)) if (!(k in prev)) delete env[k];
  Object.assign(env, prev);
  // The registry uses exactly this decision and Señales' engine adapter in mode a
  // (checked in source: importing the registry pulls En vivo's server-only deps).
  const reg = readFileSync('src/lib/tools/registry.ts', 'utf8');
  assert.match(reg, /return runsInHub\(slug, mode\)/);
  assert.match(reg, /slug === TOOL_SLUGS\.clips \? clipsHubMode\(\) : toolHubMode\(slug\)/);
  assert.match(
    reg,
    /pick\(\s*TOOL_SLUGS\.senales,\s*'SenalesAdapter',\s*createMockSenales,\s*createEngineSenales,?\s*\)/,
  );
});

// ── Mercado / Estrategias rules ───────────────────────────────────────
test('pair, venue and timeframe parsing', () => {
  assert.equal(parsePair(' btcusdt '), 'BTCUSDT');
  assert.equal(parsePair('BTC/USDT'), null);
  assert.equal(parsePair('../x'), null);
  assert.equal(parsePair('A'.repeat(21)), null);
  assert.equal(parsePair(42), null);
  assert.equal(parseVenue('binance'), 'binance');
  assert.equal(parseVenue('ftx'), 'bitunix');
  assert.equal(parseInterval('1w'), '1w');
  assert.equal(parseInterval('2h'), '5m');
  assert.equal(baseOf('SOLUSDT'), 'SOL');
  assert.equal(baseOf('USDT'), 'USDT');
});

test('backtest input is validated before it reaches the engine', () => {
  const ok = new Set(['fvg_ob']);
  const good = { strategy: 'fvg_ob', pair: 'ethusdt', timeframe: '1h', bars: 1500 };
  assert.deepEqual(validateBacktest(good, ok), { ok: true, value: { ...good, pair: 'ETHUSDT' } });
  assert.deepEqual(validateBacktest({ ...good, strategy: 'x' }, ok), {
    ok: false,
    field: 'strategy',
  });
  assert.deepEqual(validateBacktest({ ...good, pair: '' }, ok), { ok: false, field: 'pair' });
  assert.deepEqual(validateBacktest({ ...good, timeframe: '1w' }, ok), {
    ok: false,
    field: 'timeframe',
  });
  for (const bars of [99, 5001, 1.5, '1500x', null])
    assert.deepEqual(validateBacktest({ ...good, bars }, ok), { ok: false, field: 'bars' });
});

test('usage refusal kinds', () => {
  assert.equal(usageRefusalKind('no_tokens'), 'credits');
  assert.equal(usageRefusalKind('boost_unavailable'), 'credits');
  assert.equal(usageRefusalKind(undefined), 'credits');
  assert.equal(usageRefusalKind('concurrency'), 'busy');
  assert.equal(usageRefusalKind('jobs_cap'), 'cap');
  assert.equal(usageRefusalKind('storage_full'), 'too_big');
});

test('book and chart math', () => {
  assert.equal(bookTop({ bids: [], asks: [] }), null);
  assert.equal(
    bookTop({
      bids: [{ price: 2, size: 1, cumulative: 1 }],
      asks: [{ price: 1, size: 1, cumulative: 1 }],
    }),
    null,
  );
  const w = depthWidths(
    [
      { price: 1, size: 1, cumulative: 1 },
      { price: 1, size: 1, cumulative: 2 },
    ],
    [{ price: 1, size: 4, cumulative: 4 }],
  );
  assert.deepEqual(w, { bids: [25, 50], asks: [100] });
  assert.deepEqual(extent([]), [0, 1]);
  const [lo, hi] = extent([5, 5]);
  assert.ok(lo < 5 && hi > 5);
  assert.equal(scale(0, 10, 100, 0)(5), 50);
  assert.equal(scale(1, 1, 0, 10)(7), 5);
});

test('the mock adapter covers Mercado and Estrategias (mock mode and e2e)', async () => {
  const a = createMockSenales(() => 1_790_000_000_000);
  const m = await a.markets('u', 'bitunix');
  assert.ok(m.symbols.some((s) => s.symbol === 'BTCUSDT'));
  const ind = await a.indicators('u', { pair: 'BTCUSDT', interval: '5m', bars: 300 });
  assert.equal(ind.candles.length, 200);
  assert.ok(
    ind.candles.every(
      (c) => c.high >= Math.max(c.open, c.close) && c.low <= Math.min(c.open, c.close),
    ),
  );
  await assert.rejects(
    a.runBacktest('u', { strategy: 'fvg_ob', pair: 'BTCUSDT', timeframe: '5m', bars: 5000 }),
    (e: unknown) => usageReasonOf(e) === 'no_tokens',
  );
  const done = await a.runBacktest('u', {
    strategy: 'fvg_ob',
    pair: 'BTCUSDT',
    timeframe: '5m',
    bars: 1500,
  });
  assert.equal(done.status, 'done');
  assert.deepEqual(
    (await a.listBacktests('u')).map((r) => r.jobId),
    [done.jobId],
  );
  assert.deepEqual(await a.listBacktests('someone-else'), []);
});

test('Señales still never reads money fields in the new files', () => {
  for (const f of [
    'src/lib/tools/adapters/senales-engine.ts',
    'src/lib/tools/senales-market.ts',
    'src/lib/tools/senales-market-core.ts',
    'src/components/tools/senales/market-board.tsx',
    'src/components/tools/senales/strategy-lab.tsx',
    'src/components/tools/senales/market-charts.tsx',
  ]) {
    const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    assert.doesNotMatch(src, PERSONAL_FINANCE_FIELDS, f);
  }
});
