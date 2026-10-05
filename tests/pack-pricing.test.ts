// Credit packs: owner-editable prices with an IVA toggle, the Paquetes
// checkbox at checkout and its consent record (owner, 2026-10-04/05).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_PACK_PRICING,
  PACK_IDS,
  packTotalCents,
  packTotals,
  parsePackPricing,
  pesosToCents,
  type PackPricing,
} from '@/config/pack-pricing';
import { PACK_CENTS } from '@/config/pricing';
import { gatePackCharge, packConsentSentence, termsShowPrice } from '@/lib/payments/pack-checkout-core';
import { pricedTokenPacks, type PackTotals } from '@/lib/payments/pricing';
import { checkCharge, expectedChargeForPack } from '@/lib/payments/webhook-verify';
import { orderAmount, orderIdempotencyKey } from '@/lib/payments/order-charge';
import { archived } from '@/lib/legal/registry';
import { bindAmounts } from '@/lib/legal/amounts';
import { CONSENT_EVENT_TYPES } from '@/lib/billing/consent-core';
import { INVOICE_EMAIL } from '@/config/invoicing';

// The Paquetes text as a draft renders it with the given prices. The published
// 1.0 is frozen at the defaults; a price change needs a new version.
const draftPaquetes = (totals: PackTotals) => bindAmounts(archived('paquetes')!.template, totals);
const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const es = JSON.parse(read('messages/es.json'));
const en = JSON.parse(read('messages/en.json'));

const added = (rate: number, prices: PackPricing['prices'] = PACK_CENTS): PackPricing => ({
  ivaMode: 'add',
  ivaRatePercent: rate,
  prices,
});

// ── Price resolution ──────────────────────────────────────────────────────

test('defaults: $149 / $599 / $1,999 MXN, IVA included', () => {
  assert.equal(DEFAULT_PACK_PRICING.ivaMode, 'included');
  assert.equal(DEFAULT_PACK_PRICING.ivaRatePercent, 16);
  assert.deepEqual(packTotals(DEFAULT_PACK_PRICING), {
    tokens_100k: 14_900,
    tokens_500k: 59_900,
    tokens_2m: 199_900,
  });
});

test('IVA incluido: the typed price is the total', () => {
  const cfg: PackPricing = {
    ivaMode: 'included',
    ivaRatePercent: 16,
    prices: { tokens_100k: 19_900, tokens_500k: 79_950, tokens_2m: 250_000 },
  };
  for (const id of PACK_IDS) assert.equal(packTotalCents(cfg, id), cfg.prices[id]);
  // The rate is ignored while IVA is included.
  assert.deepEqual(packTotals({ ...cfg, ivaRatePercent: 0 }), packTotals(cfg));
});

test('agregar IVA: the rate is added on top, rounded to the centavo', () => {
  assert.deepEqual(packTotals(added(16)), {
    tokens_100k: 17_284,
    tokens_500k: 69_484,
    tokens_2m: 231_884,
  });
  assert.deepEqual(packTotals(added(8)), {
    tokens_100k: 16_092,
    tokens_500k: 64_692,
    tokens_2m: 215_892,
  });
  assert.equal(packTotalCents(added(16, { ...PACK_CENTS, tokens_100k: 12_345 }), 'tokens_100k'), 14_320);
  assert.deepEqual(packTotals(added(0)), packTotals(DEFAULT_PACK_PRICING));
});

test('only a complete, whole-centavo, in-range value is accepted', () => {
  assert.deepEqual(parsePackPricing(DEFAULT_PACK_PRICING), DEFAULT_PACK_PRICING);
  assert.deepEqual(parsePackPricing(JSON.parse(JSON.stringify(added(16)))), added(16));
  const bad: unknown[] = [
    null,
    undefined,
    'x',
    [],
    {},
    { ...DEFAULT_PACK_PRICING, ivaMode: 'plus' },
    { ...DEFAULT_PACK_PRICING, ivaRatePercent: 51 },
    { ...DEFAULT_PACK_PRICING, ivaRatePercent: -1 },
    { ...DEFAULT_PACK_PRICING, ivaRatePercent: 16.5 },
    { ...DEFAULT_PACK_PRICING, ivaRatePercent: '16' },
    { ...DEFAULT_PACK_PRICING, prices: { tokens_100k: 14_900, tokens_500k: 59_900 } },
    { ...DEFAULT_PACK_PRICING, prices: { ...PACK_CENTS, tokens_2m: 199_900.5 } },
    { ...DEFAULT_PACK_PRICING, prices: { ...PACK_CENTS, tokens_2m: '199900' } },
    { ...DEFAULT_PACK_PRICING, prices: { ...PACK_CENTS, tokens_100k: 0 } },
    { ...DEFAULT_PACK_PRICING, prices: { ...PACK_CENTS, tokens_100k: 10_000_001 } },
  ];
  for (const v of bad) assert.equal(parsePackPricing(v), null, JSON.stringify(v));
});

test('pesos typed in Ajustes become centavos', () => {
  assert.equal(pesosToCents('149'), 14_900);
  assert.equal(pesosToCents('1,999'), 199_900);
  assert.equal(pesosToCents('$1,999.5'), 199_950);
  assert.equal(pesosToCents('172.84'), 17_284);
  for (const s of ['', 'abc', '1.234', '-5', '1e3']) assert.equal(pesosToCents(s), null, s);
});

test('the store, the checkout and the legal page read the same totals', () => {
  const totals = packTotals(added(16));
  const packs = pricedTokenPacks(totals);
  for (const p of packs) assert.equal(p.amountCents, totals[p.id]);
  const legal = draftPaquetes(totals);
  assert.match(legal, /\| Chico \| 100,000 \| \$172\.84 MXN \|/);
  assert.match(legal, /\| Grande \| 2,000,000 \| \$2,318\.84 MXN \|/);
  for (const id of PACK_IDS) assert.ok(termsShowPrice(legal, totals[id]), id);
  assert.equal(termsShowPrice(legal, 14_900), false);
});

test('migration 0066 seeds exactly the code defaults, idempotently', () => {
  const sql = read('supabase/migrations/0066_pack_prices_setting.sql');
  const seed = /'(\{"ivaMode"[^']+\})'::jsonb/.exec(sql)?.[1];
  assert.ok(seed, 'seed row present');
  assert.deepEqual(parsePackPricing(JSON.parse(seed)), DEFAULT_PACK_PRICING);
  assert.match(sql, /on conflict \(key\) do nothing/);
  assert.match(sql, /create or replace function public\.pack_prices_valid/);
  assert.match(sql, /if not exists \([\s\S]*?app_settings_pack_prices_valid/);
});

// ── Checkout: consent, price shown = price charged ────────────────────────

const LIVE: PackTotals = packTotals(DEFAULT_PACK_PRICING);
const terms = (totals: PackTotals) => draftPaquetes(totals);

function deps(totals: PackTotals | null | 'throw') {
  let loads = 0;
  return {
    get loads() {
      return loads;
    },
    loadTotals: async () => {
      loads += 1;
      if (totals === 'throw') throw new Error('db down');
      return totals;
    },
    termsText: terms,
  };
}

test('the server refuses a pack checkout without the box ticked, before reading anything', async () => {
  for (const accepted of [false, undefined, null, 'true', 1, 'on']) {
    const d = deps(LIVE);
    const r = await gatePackCharge({ packId: 'tokens_500k', accepted, shownCents: 59_900 }, d);
    assert.deepEqual(r, { ok: false, reason: 'consent_required' }, String(accepted));
    assert.equal(d.loads, 0);
  }
});

test('missing or unreadable prices fail closed', async () => {
  for (const totals of [null, 'throw'] as const) {
    const r = await gatePackCharge({ packId: 'tokens_500k', accepted: true, shownCents: 59_900 }, deps(totals));
    assert.deepEqual(r, { ok: false, reason: 'not_configured' });
  }
});

test('a total that is not the one in force is refused', async () => {
  for (const shownCents of [17_284, 59_899, '59900', 599, undefined]) {
    const r = await gatePackCharge({ packId: 'tokens_500k', accepted: true, shownCents }, deps(LIVE));
    assert.deepEqual(r, { ok: false, reason: 'price_changed' }, String(shownCents));
  }
  const unknown = await gatePackCharge({ packId: 'tokens_9z', accepted: true, shownCents: 1 }, deps(LIVE));
  assert.deepEqual(unknown, { ok: false, reason: 'unknown_pack' });
});

test('terms that show another price close the checkout', async () => {
  const r = await gatePackCharge(
    { packId: 'tokens_500k', accepted: true, shownCents: 59_900 },
    { loadTotals: async () => LIVE, termsText: () => terms(packTotals(added(16))) },
  );
  assert.deepEqual(r, { ok: false, reason: 'terms_mismatch' });
});

test('the amount sent to Mercado Pago is the amount the page showed', async () => {
  for (const cfg of [DEFAULT_PACK_PRICING, added(16), added(8)]) {
    const totals = packTotals(cfg);
    for (const id of PACK_IDS) {
      const shown = totals[id];
      const r = await gatePackCharge({ packId: id, accepted: true, shownCents: shown }, deps(totals));
      assert.ok(r.ok, id);
      assert.equal(r.cents, shown);
      assert.equal(r.amount, orderAmount(shown));
      assert.equal(Math.round(Number(r.amount) * 100), shown);
      assert.ok(termsShowPrice(r.termsText, shown));
      // …and the webhook's gate accepts exactly that.
      const expected = expectedChargeForPack(id, totals[id])!;
      assert.ok(checkCharge(expected, { amountMajor: Number(r.amount), currency: 'MXN' }).ok);
    }
  }
});

test('both pack actions gate and record consent before creating the order', () => {
  const src = read('src/lib/payments/token-checkout-actions.ts');
  for (const fn of ['createTokenPackCheckout', 'payTokenPackWithCard']) {
    const body = src.slice(src.indexOf(`export async function ${fn}`));
    const gate = body.indexOf('await acceptPackCharge(input, session');
    const create = body.indexOf('order.create(');
    assert.ok(gate > 0 && create > gate, `${fn}: gate before order.create`);
    assert.match(body.slice(gate, create), /if \(!accepted\.ok\) return accepted;/);
    assert.match(body.slice(gate, create), /const \{ pack, amount \} = accepted;/);
    assert.match(body.slice(create), /total_amount: amount,/);
    assert.match(body.slice(create), /amountCents: accepted\.cents/);
  }
  const accept = src.slice(src.indexOf('async function acceptPackCharge'));
  assert.ok(accept.indexOf('gatePackCharge(') < accept.indexOf('recordPackConsent('));
  assert.match(accept, /consent not stored — refusing before any charge/);
  assert.doesNotMatch(src, /amountCents\)/, 'no price read from a static pack list');
});

test('the consent record has the evidence the plan checkout stores', () => {
  assert.ok((CONSENT_EVENT_TYPES as readonly string[]).includes('pack_purchase_accepted'));
  const src = read('src/lib/payments/pack-consent.ts');
  for (const field of [
    'event_type: PACK_CONSENT_EVENT',
    "{ ...legalDocument('paquetes'), sha256: sha256(input.termsText) }",
    'ui_version: UI_VERSION',
    'checkbox_checked: true',
    'checkbox_text: stripMarkup(packConsentSentence(t, vars))',
    'plan_id: input.pack.id',
    'amount_mxn: input.cents / 100',
    'tax_included: true',
    'ip_address: ctx.ip',
  ])
    assert.ok(src.includes(field), field);
  assert.match(read('src/lib/billing/consent.ts'), /UI_VERSION = '[^']+-packs'/);
});

test('the checkbox says Law’s §9.1 sentence with the amount in force', () => {
  const t = (key: string, v?: Record<string, string | number>) =>
    (es.packCheckout[key] as string).replace(/\{(\w+)\}/g, (_, k) => String(v?.[k]));
  const s = packConsentSentence(t, { cents: 59_900, tokens: 500_000, locale: 'es' });
  assert.equal(
    s,
    'Acepto un <b>cargo único de $599 MXN (IVA incluido)</b> por <b>500,000 créditos extra</b>. No es una suscripción y no se renueva. Los créditos no vencen mientras mi cuenta exista, no son dinero y no se pueden transferir. Acepto los <terms>Términos de los Paquetes de Créditos</terms>.',
  );
  const page = read('src/components/workspace/pack-checkout.tsx');
  assert.match(page, /useState\(false\)/, 'unchecked by default');
  assert.match(page, /disabled=\{!checked \|\| busy/);
  assert.match(page, /termsHref="\/legal\/packs"/);
});

// ── Copy: invoices and IVA by currency ────────────────────────────────────

test('checkout and Mis créditos say how to ask for a CFDI', () => {
  assert.equal(INVOICE_EMAIL, 'hola@chalyb.com');
  for (const m of [es, en]) {
    for (const s of [m.packCheckout.invoice, m.credits.invoice]) {
      assert.match(s, /CFDI/);
      assert.match(s, /RFC/);
      assert.match(s, /\{correo\}/);
    }
  }
  assert.match(read('src/app/[locale]/(dashboard)/app/usage/checkout/page.tsx'), /'invoice', \{ correo: INVOICE_EMAIL/);
  assert.match(read('src/app/[locale]/(dashboard)/app/usage/page.tsx'), /'invoice', \{ correo: INVOICE_EMAIL/);
});

test('MXN amounts say IVA included; USD footers never do', () => {
  for (const m of [es, en]) {
    for (const k of ['taxUS', 'taxCA']) assert.doesNotMatch(m.billing.price[k], /IVA|VAT/i, k);
  }
  assert.match(es.packCheckout.ivaIncluded, /MXN, IVA incluido/);
});

test('no amount is typed in the pack copy', () => {
  for (const m of [es, en]) {
    const text = JSON.stringify(m.packCheckout) + JSON.stringify(m.credits);
    assert.doesNotMatch(text, /\$\s?\d/);
  }
});

test('changing the price inside the idempotency window makes a new order', () => {
  const base = { userId: 'u', packId: 'tokens_100k', mode: 'card' as const, now: new Date(0) };
  assert.notEqual(
    orderIdempotencyKey({ ...base, amountCents: 14_900 }),
    orderIdempotencyKey({ ...base, amountCents: 17_284 }),
  );
});

test('the webhook honours an amount the buyer accepted before a price change', () => {
  const e = expectedChargeForPack('tokens_100k', 19_900, [17_000])!;
  assert.ok(checkCharge(e, { amountMajor: 199, currency: 'MXN' }).ok);
  assert.ok(checkCharge(e, { amountMajor: 170, currency: 'MXN' }).ok);
  assert.equal(checkCharge(e, { amountMajor: 1, currency: 'MXN' }).ok, false);
});
