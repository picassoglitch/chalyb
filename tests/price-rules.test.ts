// Prices (BUILD-SPEC §6.1–6.2, §11.1; rebuild P2-10). Deploy-blocking.

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { annualMath, ivaPortion, packPriceCents, planPrice, withIva } from '@/config/pricing';
import { formatMXN } from '@/lib/billing/format';
import { TIER_PRICING, TOKEN_PACKS } from '@/lib/payments/pricing';
import { checkCharge, expectedChargeForPack, expectedChargeForTier } from '@/lib/payments/webhook-verify';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

test('Q1: list prices exclude IVA, so totals add 16%', () => {
  delete process.env.PRICES_INCLUDE_IVA;
  assert.equal(planPrice('pro_month').totalCents, 86_884);
  assert.equal(planPrice('pro_year').totalCents, 868_840);
  assert.equal(planPrice('vip_month').totalCents, 289_884);
  assert.equal(formatMXN(planPrice('pro_month').totalCents), '$868.84');
  assert.equal(formatMXN(planPrice('pro_year').totalCents), '$8,688.40');
  assert.equal(formatMXN(planPrice('vip_month').totalCents), '$2,898.84');
  assert.deepEqual(
    (['tokens_100k', 'tokens_500k', 'tokens_2m'] as const).map(packPriceCents),
    [17_284, 69_484, 231_884],
  );
});

test('derived annual numbers follow the totals', () => {
  delete process.env.PRICES_INCLUDE_IVA;
  assert.deepEqual(annualMath(), {
    yearMonthlyEquivalentCents: 72_400, // $724
    yearVsMonthlyCents: 1_042_608, // $10,426.08
    yearSavingsCents: 173_768, // $1,737.68
  });
});

test('PRICES_INCLUDE_IVA=true treats list prices as totals (the BUILD-SPEC figures)', () => {
  process.env.PRICES_INCLUDE_IVA = 'true';
  try {
    assert.equal(planPrice('pro_month').totalCents, 74_900);
    assert.deepEqual(annualMath(), {
      yearMonthlyEquivalentCents: 62_400, // $624
      yearVsMonthlyCents: 898_800, // $8,988
      yearSavingsCents: 149_800, // $1,498
    });
  } finally {
    delete process.env.PRICES_INCLUDE_IVA;
  }
});

test('IVA portion of a total', () => {
  assert.equal(ivaPortion(86_884), 11_984);
  assert.equal(withIva(10_000, false), 11_600);
});

test('Mercado Pago charges the IVA-inclusive totals', () => {
  assert.equal(TIER_PRICING.PRO!.amountCents, planPrice('pro_month').totalCents);
  assert.equal(TIER_PRICING.VIP!.amountCents, planPrice('vip_month').totalCents);
  for (const pack of TOKEN_PACKS) assert.equal(pack.amountCents, packPriceCents(pack.id));
});

test('the price gate accepts today’s totals and the grandfathered pre-IVA ones only', () => {
  const pro = expectedChargeForTier('PRO')!;
  assert.ok(checkCharge(pro, { amountMajor: 868.84, currency: 'MXN' }).ok);
  assert.ok(checkCharge(pro, { amountMajor: 749, currency: 'MXN' }).ok, 'existing subscriptions keep renewing');
  assert.equal(checkCharge(pro, { amountMajor: 1, currency: 'MXN' }).ok, false);
  assert.equal(checkCharge(pro, { amountMajor: 868.84, currency: 'USD' }).ok, false);
  const pack = expectedChargeForPack('tokens_100k')!;
  assert.ok(checkCharge(pack, { amountMajor: 172.84, currency: 'MXN' }).ok);
  assert.ok(checkCharge(pack, { amountMajor: 149, currency: 'MXN' }).ok);
  assert.equal(checkCharge(pack, { amountMajor: 599, currency: 'MXN' }).ok, false);
});

function* files(dir: string, ext: RegExp): Generator<string> {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path, ext);
    else if (ext.test(name)) yield path;
  }
}

test('forbidden price claims appear nowhere (messages, emails, built bundle)', () => {
  const sources = [
    join(ROOT, 'messages/es.json'),
    join(ROOT, 'messages/en.json'),
    ...files(join(ROOT, 'src/lib/email'), /\.ts$/),
    // Only when a build exists (CI runs `pnpm build` first).
    ...files(join(ROOT, '.next/static'), /\.js$/),
  ];
  const hits: string[] = [];
  for (const file of sources) {
    const text = readFileSync(file, 'utf8');
    if (/2 meses gratis|two months free/i.test(text)) hits.push(`${file}: "2 meses gratis"`);
    // The annual comparison may only appear as "vs. … pagando mes a mes".
    for (const m of text.matchAll(/\$(8,988|10,426\.08)/g)) {
      const around = text.slice(Math.max(0, m.index! - 10), m.index! + 40);
      if (!/vs\.\s*\$[\d,.]+ pagando mes a mes/.test(around)) hits.push(`${file}: bare ${m[0]}`);
    }
  }
  assert.deepEqual(hits, []);
});
