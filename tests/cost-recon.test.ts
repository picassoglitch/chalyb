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
