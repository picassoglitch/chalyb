// Prices (PRICING-CARDS-SPEC §0.2 / §13 / §16; all-pending WS-2). Deploy-blocking.

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  annualMath,
  discountPct,
  GRANDFATHERED_CENTS,
  grandfatheredFor,
  ivaPortion,
  PACK_CENTS,
  packPriceCents,
  pct,
  planPrice,
  pricesIncludeIva,
  PRICE_CENTS,
  REFERENCE_CENTS,
  referencePriceState,
  taxRegion,
  togglePct,
  USD_REF,
  withIva,
} from '@/config/pricing';
import { formatMXN } from '@/lib/billing/format';
import { TIER_PRICING, TOKEN_PACKS } from '@/lib/payments/pricing';
import {
  checkCharge,
  expectedChargeForPack,
  expectedChargeForTier,
} from '@/lib/payments/webhook-verify';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

test('prices are IVA-included totals by default (a missing env var never adds 16%)', () => {
  delete process.env.PRICES_INCLUDE_IVA;
  assert.equal(pricesIncludeIva(), true);
  assert.equal(planPrice('pro_month').totalCents, 99_700);
  assert.equal(planPrice('pro_year').totalCents, 997_000);
  assert.equal(planPrice('vip_month').totalCents, 379_900);
  assert.equal(PRICE_CENTS.vip.year, 3_632_500);
  assert.equal(formatMXN(planPrice('pro_month').totalCents), '$997');
  assert.equal(formatMXN(planPrice('pro_year').totalCents), '$9,970');
  assert.equal(formatMXN(planPrice('vip_month').totalCents), '$3,799');
  assert.equal(formatMXN(PRICE_CENTS.vip.year), '$36,325');
});

test('PRICES_INCLUDE_IVA=false treats the amounts as list prices (what-if only)', () => {
  process.env.PRICES_INCLUDE_IVA = 'false';
  try {
    assert.equal(planPrice('pro_month').totalCents, 115_652);
  } finally {
    delete process.env.PRICES_INCLUDE_IVA;
  }
});

test('packs stay at today’s totals whatever the IVA flag says (O-4)', () => {
  for (const flag of [undefined, 'true', 'false']) {
    if (flag === undefined) delete process.env.PRICES_INCLUDE_IVA;
    else process.env.PRICES_INCLUDE_IVA = flag;
    assert.deepEqual(
      (['tokens_100k', 'tokens_500k', 'tokens_2m'] as const).map(packPriceCents),
      [17_284, 69_484, 231_884],
    );
  }
  delete process.env.PRICES_INCLUDE_IVA;
  assert.deepEqual(PACK_CENTS, { tokens_100k: 17_284, tokens_500k: 69_484, tokens_2m: 231_884 });
  assert.equal(formatMXN(PACK_CENTS.tokens_100k), '$172.84');
});

test('annual math, savings and percentages (floor)', () => {
  delete process.env.PRICES_INCLUDE_IVA;
  assert.deepEqual(annualMath('pro'), { yearVsMonthlyCents: 1_196_400, yearSavingsCents: 199_400 });
  assert.deepEqual(annualMath('vip'), { yearVsMonthlyCents: 4_558_800, yearSavingsCents: 926_300 });
  assert.equal(formatMXN(annualMath('pro').yearSavingsCents), '$1,994');
  assert.equal(formatMXN(annualMath('vip').yearSavingsCents), '$9,263');
  assert.equal(pct('pro'), 16);
  assert.equal(pct('vip'), 20);
  assert.equal(togglePct(), 20);
  assert.equal(togglePct(['pro']), 16);
  assert.equal(togglePct([]), 0);
});

test('discountPct(now, ref) floors and never overstates', () => {
  assert.equal(discountPct(99_700, 166_200), 40);
  assert.equal(discountPct(99_700, 166_000), 39);
  assert.equal(discountPct(5_000, 8_300), 39);
  assert.equal(discountPct(5_000, 8_400), 40);
  assert.equal(discountPct(99_700, 99_700), 0);
});

test('IVA portion of a total, for receipts', () => {
  assert.equal(ivaPortion(99_700), 13_752);
  assert.equal(99_700 - ivaPortion(99_700), 85_948);
  assert.equal(withIva(10_000, false), 11_600);
});

test('Mercado Pago charges the same totals the cards show', () => {
  assert.equal(TIER_PRICING.PRO!.amountCents, planPrice('pro_month').totalCents);
  assert.equal(TIER_PRICING.VIP!.amountCents, planPrice('vip_month').totalCents);
  for (const pack of TOKEN_PACKS) assert.equal(pack.amountCents, packPriceCents(pack.id));
});

test('grandfathered amounts are hard-coded, not derived from the prices', () => {
  assert.deepEqual(GRANDFATHERED_CENTS.PRO, [74_900, 86_884]);
  assert.deepEqual(GRANDFATHERED_CENTS.VIP, [249_900, 289_884]);
  assert.deepEqual(grandfatheredFor('pro_year'), []);
  assert.deepEqual(grandfatheredFor('pro_month'), [74_900, 86_884]);
  assert.deepEqual(grandfatheredFor('vip_month'), [249_900, 289_884]);
});

test('the price gate: today’s totals, existing renewals, nothing else', () => {
  const pro = expectedChargeForTier('PRO')!;
  for (const amount of [997, 749, 868.84]) {
    assert.ok(checkCharge(pro, { amountMajor: amount, currency: 'MXN' }).ok, String(amount));
  }
  assert.equal(checkCharge(pro, { amountMajor: 1, currency: 'MXN' }).ok, false);
  assert.equal(checkCharge(pro, { amountMajor: 997, currency: 'USD' }).ok, false);
  const vip = expectedChargeForTier('VIP')!;
  for (const amount of [3799, 2499, 2898.84]) {
    assert.ok(checkCharge(vip, { amountMajor: amount, currency: 'MXN' }).ok, String(amount));
  }
  const yearly = {
    amountCents: planPrice('pro_year').totalCents,
    alsoAcceptCents: grandfatheredFor('pro_year'),
    currency: 'MXN',
    label: 'plan pro_year',
  };
  assert.ok(checkCharge(yearly, { amountMajor: 9970, currency: 'MXN' }).ok);
  assert.equal(checkCharge(yearly, { amountMajor: 749, currency: 'MXN' }).ok, false);
  assert.equal(checkCharge(yearly, { amountMajor: 8688.4, currency: 'MXN' }).ok, false);
  const pack = expectedChargeForPack('tokens_100k')!;
  assert.ok(checkCharge(pack, { amountMajor: 172.84, currency: 'MXN' }).ok);
  assert.ok(checkCharge(pack, { amountMajor: 149, currency: 'MXN' }).ok);
  assert.equal(checkCharge(pack, { amountMajor: 599, currency: 'MXN' }).ok, false);
});

const REF_ENV = {
  SHOW_REFERENCE_PRICE: 'true',
  REFERENCE_PRICE_SITE: 'otrositio.mx',
  REFERENCE_PRICE_DATE: '30 de septiembre de 2026',
  REFERENCE_PRICE_PROMO_END: '31 de diciembre de 2026',
  REFERENCE_PRICE_UNTIL: '2026-12-31T06:00:00Z',
};

test('reference price: off by default, on only with every value and before the cut-off', () => {
  const now = new Date('2026-10-03T16:00:00Z');
  assert.deepEqual(referencePriceState(now, {}), { show: false });
  const on = referencePriceState(now, REF_ENV);
  assert.equal(on.show, true);
  assert.equal(on.refCents, REFERENCE_CENTS.pro_month);
  assert.equal(on.pct, 40);
  assert.equal(on.site, 'otrositio.mx');
  assert.equal(on.date, '30 de septiembre de 2026');
  for (const missing of [
    'REFERENCE_PRICE_SITE',
    'REFERENCE_PRICE_DATE',
    'REFERENCE_PRICE_PROMO_END',
    'REFERENCE_PRICE_UNTIL',
  ]) {
    assert.equal(referencePriceState(now, { ...REF_ENV, [missing]: '' }).show, false, missing);
  }
  assert.equal(
    referencePriceState(new Date('2026-12-31T06:00:00Z'), REF_ENV).show,
    false,
    'past the cut-off',
  );
  assert.equal(referencePriceState(now, REF_ENV, { grandfathered: true }).show, false);
  assert.deepEqual(USD_REF, {});
});

test('reference label A and the launch fallback, verbatim', () => {
  const es = JSON.parse(readFileSync(join(ROOT, 'messages/es.json'), 'utf8')).billing.price.ref;
  assert.equal(
    es.labelA1,
    'Precio anterior en <b>{sitio}</b> hasta el <b>{fecha}</b>. Aquí pagas {pct}% menos.',
  );
  assert.equal(es.labelA2, 'Precio de lanzamiento vigente hasta el <b>{fecha_fin_promo}</b>.');
  assert.equal(es.launch, 'Precio de lanzamiento: {monto} MXN al mes');
  const en = JSON.parse(readFileSync(join(ROOT, 'messages/en.json'), 'utf8')).billing.price.ref;
  assert.equal(en.launch, 'Launch price: {monto} MXN a month');
});

test('tax footer by billing country; MXN everywhere while USD is off', () => {
  assert.equal(taxRegion('US', false), 'MX');
  assert.equal(taxRegion('CA', false), 'MX');
  assert.equal(taxRegion('US', true), 'US');
  assert.equal(taxRegion('ca', true), 'CA');
  assert.equal(taxRegion('MX', true), 'MX');
  const es = JSON.parse(readFileSync(join(ROOT, 'messages/es.json'), 'utf8')).billing.price;
  assert.equal(es.tax, 'Precios en MXN, IVA incluido.');
  assert.equal(
    es.taxUS,
    'Prices in US dollars. Sales tax, if any, is added at checkout and shown before you pay.',
  );
  assert.equal(
    es.taxCA,
    'Prices in US dollars (USD). GST/HST and, in Quebec, QST are added where applicable and shown before you pay.',
  );
});

function* files(dir: string, ext: RegExp): Generator<string> {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path, ext);
    else if (ext.test(name)) yield path;
  }
}

test('banned amounts appear nowhere (messages, emails, components, legal, JSON-LD, built bundle)', () => {
  const sources = [
    join(ROOT, 'messages/es.json'),
    join(ROOT, 'messages/en.json'),
    ...files(join(ROOT, 'src/lib/email'), /\.ts$/),
    ...files(join(ROOT, 'src/components'), /\.tsx?$/),
    ...files(join(ROOT, 'src/content/legal'), /\.tsx?$/),
    join(ROOT, 'src/lib/seo/json-ld.ts'),
    // Only when a build exists (CI runs `pnpm build` first).
    ...files(join(ROOT, '.next/static'), /\.js$/),
  ];
  const hits: string[] = [];
  for (const file of sources) {
    const text = readFileSync(file, 'utf8');
    // Customer copy only: component comments may name the banned phrase.
    if (!/\.tsx?$/.test(file) || file.includes(`${join('src', 'lib', 'email')}`)) {
      if (/2 meses gratis|two months free/i.test(text)) hits.push(`${file}: "2 meses gratis"`);
    }
    for (const m of text.matchAll(/\$(868\.84|8,688\.40|2,898\.84|10,426\.08|34,786\.08)/g)) {
      hits.push(`${file}: ${m[0]}`);
    }
    // 12 × monthly is never a "vs." or struck anchor.
    for (const m of text.matchAll(/(vs\.?|<s>|<del>)\s*\$(11,964|45,588)/g))
      hits.push(`${file}: ${m[0]}`);
  }
  assert.deepEqual(hits, []);
});

test('no stale amounts in the source outside the grandfather list and its tests', () => {
  const hits: string[] = [];
  for (const file of [
    ...files(join(ROOT, 'src'), /\.(ts|tsx)$/),
    join(ROOT, 'messages/es.json'),
    join(ROOT, 'messages/en.json'),
  ]) {
    if (file.endsWith(join('config', 'pricing.ts'))) continue;
    const text = readFileSync(file, 'utf8');
    if (/868\.84|8,688\.40|2,898\.84|74_900|249_900/.test(text)) hits.push(file);
  }
  assert.deepEqual(hits, []);
});

test('a struck price renders only in the reference component, around the reference amount', () => {
  const hits: string[] = [];
  for (const file of files(join(ROOT, 'src/components'), /\.tsx$/)) {
    const src = readFileSync(file, 'utf8');
    if (!/line-through|<s>|<del>/.test(src)) continue;
    if (
      file.endsWith(join('billing', 'reference-price.tsx')) &&
      /<s>\{formatMXN\(state\.refCents\)\}<\/s>/.test(src)
    )
      continue;
    hits.push(file);
  }
  assert.deepEqual(hits, []);
});
