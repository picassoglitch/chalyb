// Dinero · Anthropic reconciliation: the real cost query must fail loudly and
// with its cause (bad key, timeout, API error), never hang the admin page.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CostReportError, fetchCostReport } from '@/lib/usage/reconciliation-core';

const start = new Date('2026-11-01T00:00:00Z');
const end = new Date('2026-11-06T00:00:00Z');

const json = (status: number, body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

test('a 401 from Anthropic is a key problem, not "no respondió"', async () => {
  const f = json(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } });
  await assert.rejects(fetchCostReport(start, end, 'k', { fetch: f }), (e: unknown) => {
    assert.ok(e instanceof CostReportError);
    assert.equal(e.kind, 'auth');
    assert.equal(e.status, 401);
    assert.equal(e.message, 'Anthropic 401: invalid x-api-key');
    return true;
  });
});

test('a hung Anthropic call times out instead of spinning forever', async () => {
  const hang = ((_u: unknown, init?: RequestInit) =>
    new Promise((_r, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)))) as typeof fetch;
  const t0 = Date.now();
  await assert.rejects(fetchCostReport(start, end, 'k', { fetch: hang, timeoutMs: 50 }), (e: unknown) => {
    assert.ok(e instanceof CostReportError);
    assert.equal(e.kind, 'timeout');
    return true;
  });
  assert.ok(Date.now() - t0 < 2000);
});

test('a 5xx is an API error with its status', async () => {
  await assert.rejects(fetchCostReport(start, end, 'k', { fetch: json(529, { error: { type: 'overloaded_error' } }) }), (e: unknown) => {
    assert.ok(e instanceof CostReportError);
    assert.equal(e.kind, 'api');
    assert.equal(e.status, 529);
    return true;
  });
});

test('pages are followed and the admin key is sent', async () => {
  const seen: string[] = [];
  const f = (async (u: string | URL, init?: RequestInit) => {
    seen.push(String(u));
    assert.equal((init?.headers as Record<string, string>)['x-api-key'], 'k');
    const page = new URL(String(u)).searchParams.get('page');
    return new Response(
      JSON.stringify({
        data: [{ starting_at: 'a', ending_at: 'b', results: [{ amount: '100', currency: 'USD', model: 'claude-haiku-4-5' }] }],
        has_more: !page,
        next_page: page ? null : 'p2',
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  const pages = await fetchCostReport(start, end, 'k', { fetch: f });
  assert.equal(pages.length, 2);
  assert.match(seen[0] ?? '', /\/v1\/organizations\/cost_report\?/);
  assert.match(seen[1] ?? '', /page=p2/);
});

test('every failure kind has copy, and measured vs estimated are labeled', () => {
  for (const locale of ['es', 'en']) {
    const m = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
    const recon = m.admin.money.recon;
    for (const k of ['no_key', 'auth', 'timeout', 'api', 'db']) assert.ok(recon.error[k], `${locale}: error.${k}`);
    assert.ok(recon.measured && recon.estimated && recon.unverified, `${locale}: measured/estimated/unverified`);
  }
});

test('a 200 with a broken body says so, not "red"', async () => {
  const f = (async () => new Response('<html>oops', { status: 200 })) as typeof fetch;
  await assert.rejects(fetchCostReport(start, end, 'k', { fetch: f }), (e: unknown) => {
    assert.ok(e instanceof CostReportError);
    assert.equal(e.kind, 'api');
    assert.match(e.message, /respuesta inválida/);
    return true;
  });
});

// Codex P2 — an upstream that echoes the key must not leak it to logs or the UI.
const KEY = 'sk-ant-admin01-TESTSECRET_abc123';
const echo = (asJson: boolean) =>
  (async () =>
    new Response(
      asJson
        ? JSON.stringify({ error: { type: 'authentication_error', message: `bad key ${KEY} / also sk-ant-api03-OTHER` } })
        : `<html>proxy says x-api-key: ${KEY}</html>`,
      { status: 401 },
    )) as typeof fetch;

test('the key is redacted from every error built from an Anthropic response', async () => {
  for (const asJson of [true, false]) {
    await assert.rejects(fetchCostReport(start, end, KEY, { fetch: echo(asJson) }), (e: unknown) => {
      assert.ok(e instanceof CostReportError);
      assert.ok(!e.message.includes(KEY), e.message);
      assert.ok(!/sk-ant-/.test(e.message), e.message);
      return true;
    });
  }
});

test('the recon detail and the sync-button error never carry the key', async () => {
  const realFetch = globalThis.fetch;
  const realKey = process.env.ANTHROPIC_ADMIN_KEY;
  const realLog = console.error;
  const logged: string[] = [];
  process.env.ANTHROPIC_ADMIN_KEY = KEY;
  console.error = (...a: unknown[]) => void logged.push(a.map(String).join(' '));
  try {
    const { reconcileAnthropic } = await import('@/lib/usage/reconciliation');
    const { computeAnthropicBlendedRate } = await import('@/lib/engines/anthropic-billing');
    for (const asJson of [true, false]) {
      globalThis.fetch = echo(asJson);
      const recon = await reconcileAnthropic(new Date('2026-11-06T00:00:00Z'));
      assert.equal(recon.ok, false);
      const detail = recon.ok ? '' : (recon.detail ?? '');
      assert.ok(detail && !/sk-ant-/.test(detail), detail);
      const sync = await computeAnthropicBlendedRate(30);
      assert.equal(sync.ok, false);
      assert.ok(sync.error && !/sk-ant-/.test(sync.error), sync.error);
    }
    assert.ok(logged.length > 0 && logged.every((l) => !/sk-ant-/.test(l)), logged.join('\n'));
  } finally {
    globalThis.fetch = realFetch;
    console.error = realLog;
    if (realKey === undefined) delete process.env.ANTHROPIC_ADMIN_KEY;
    else process.env.ANTHROPIC_ADMIN_KEY = realKey;
  }
});
