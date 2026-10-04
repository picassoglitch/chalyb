// Landing `/` (LANDING-SPEC §4, §6, §11): no amount typed in the landing
// components, the CTA links each `cta_id` points at, and the JSON-LD built
// from the pricing config and the FAQ the page shows.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { landingTrialHref, tagPricingHref } from '@/components/landing/links';
import { faqItems } from '@/components/landing/faq-items';
import { planPrice } from '@/config/pricing';
import { formatMXN } from '@/lib/billing/format';
import { faqPageData, jsonLdData } from '@/lib/seo/json-ld';
import type { PublicTool } from '@/lib/tools/public-tools';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesUnder(join(dir, e.name)) : [join(dir, e.name)],
  );
}

const es = JSON.parse(readFileSync(join(ROOT, 'messages/es.json'), 'utf8'));
const faqT = (key: string, values: Record<string, string> = {}) =>
  (es.landing.faq[key] as string).replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? `{${k}}`);

const tool = (slug: PublicTool['slug'], name: string): PublicTool => ({
  slug,
  name,
  color: '#000',
});
const TOOLS = [
  tool('chalybclip', 'Clips'),
  tool('chalybcrypto', 'Señales'),
  tool('chalybobs', 'En vivo'),
];

// ---------- §11 · amounts only from config ----------

test('no amount is typed in src/components/landing/** ($ followed by a digit)', () => {
  const files = filesUnder(join(ROOT, 'src/components/landing'));
  assert.ok(files.length > 0);
  for (const f of files) {
    const hits = readFileSync(f, 'utf8').match(/\$\d[\d,.]*/g);
    assert.equal(hits, null, `${f.slice(ROOT.length)}: ${hits}`);
  }
});

// ---------- §4 · CTA links ----------

test('landingTrialHref: sign-up with the trial intent, the toggle interval and `from`', () => {
  assert.equal(
    landingTrialHref({ from: 'hero_trial', trialFlowEnabled: true, signedIn: false }),
    '/sign-in?mode=signup&plan=pro&intent=trial&interval=year&from=hero_trial',
  );
  assert.equal(
    landingTrialHref({
      from: 'pricing_pro',
      interval: 'month',
      trialFlowEnabled: true,
      signedIn: false,
    }),
    '/sign-in?mode=signup&plan=pro&intent=trial&interval=month&from=pricing_pro',
  );
  for (const from of [
    'nav_trial',
    'tools_trial',
    'final_trial',
    'sticky_trial',
    'menu_trial',
  ] as const)
    assert.match(
      landingTrialHref({ from, trialFlowEnabled: true, signedIn: false }),
      new RegExp(`&from=${from}$`),
    );
});

test('landingTrialHref: no trial claim without the flow; the app for a signed-in visitor', () => {
  const off = landingTrialHref({ from: 'final_trial', trialFlowEnabled: false, signedIn: false });
  assert.equal(off, '/sign-in?mode=signup&plan=pro&interval=year&from=final_trial');
  assert.doesNotMatch(off, /intent=trial/);
  for (const trialFlowEnabled of [true, false])
    assert.equal(
      landingTrialHref({ from: 'hero_trial', trialFlowEnabled, signedIn: true }),
      '/app/prueba',
    );
});

test('tagPricingHref: tags sign-up links with plan and from, leaves the rest alone', () => {
  assert.equal(tagPricingHref(null, 'pro'), null);
  assert.equal(tagPricingHref('/app/prueba?interval=month', 'pro'), '/app/prueba?interval=month');
  assert.equal(
    tagPricingHref('/sign-in?mode=signup&intent=trial&interval=month', 'pro'),
    '/sign-in?mode=signup&intent=trial&interval=month&plan=pro&from=pricing_pro',
  );
  assert.equal(
    tagPricingHref('/sign-in?mode=signup&plan=free', 'free'),
    '/sign-in?mode=signup&plan=free&from=pricing_free',
  );
  // An existing plan is kept; a stale `from` is replaced.
  assert.equal(
    tagPricingHref('/sign-in?mode=signup&plan=vip&interval=year&from=x', 'vip'),
    '/sign-in?mode=signup&plan=vip&interval=year&from=pricing_vip',
  );
});

// ---------- §6 · JSON-LD ----------

type Node = { '@type': string; [k: string]: unknown };
const graph = (...args: Parameters<typeof jsonLdData>) => jsonLdData(...args)['@graph'] as Node[];
const byType = (nodes: Node[], type: string) => nodes.find((n) => n['@type'] === type);

test('JSON-LD: Organization, SoftwareApplication and WebSite on the canonical origin', () => {
  const nodes = graph('https://www.chalyb.com');
  assert.deepEqual(
    nodes.map((n) => n['@type']),
    ['Organization', 'SoftwareApplication', 'WebSite'],
  );
  const org = byType(nodes, 'Organization')!;
  assert.equal(org.name, 'Chalyb');
  assert.equal(org.url, 'https://www.chalyb.com/');
  assert.match(org.logo as string, /^https:\/\/www\.chalyb\.com\/.+\.png$/);
  assert.equal(byType(nodes, 'WebSite')!.url, 'https://www.chalyb.com/');
});

test('JSON-LD: SoftwareApplication offers are PRICING totals, none when not for sale', () => {
  const offers = (vipYear: boolean) =>
    byType(graph('https://www.chalyb.com', vipYear), 'SoftwareApplication')!.offers as {
      price: string;
      priceCurrency: string;
    }[];
  const total = (k: Parameters<typeof planPrice>[0]) => (planPrice(k).totalCents / 100).toFixed(2);
  assert.deepEqual(
    offers(false).map((o) => o.price),
    [total('pro_year'), total('pro_month'), total('vip_month')],
  );
  assert.equal(offers(true).at(-1)!.price, total('vip_year'));
  assert.ok(offers(true).every((o) => o.priceCurrency === 'MXN'));
  const app = byType(graph('https://www.chalyb.com', true, false), 'SoftwareApplication')!;
  assert.equal('offers' in app, false);
});

test('json-ld.tsx still gates the offers on paid checkout and published terms', () => {
  const src = readFileSync(join(ROOT, 'src/components/landing/json-ld.tsx'), 'utf8');
  assert.match(src, /paidCheckoutEnabled\(\) && legalPublished\(\)/);
  assert.match(src, /faqItems\(/);
});

test('FAQPage: the 8 questions, Q1 only with the trial, Q6 only with Señales', () => {
  const opts = { tools: TOOLS, locale: 'es', trialOffered: true, claimAll: true };
  const all = faqItems(faqT, opts);
  assert.deepEqual(
    all.map((i) => i.id),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  assert.deepEqual(
    all.map((i) => i.q),
    [1, 2, 3, 4, 5, 6, 7, 8].map((n) => es.landing.faq[`q${n}`]),
  );
  assert.ok(
    all.every((i) => !/\{\w+\}/.test(i.a)),
    'every placeholder filled',
  );
  const a2 = all.find((i) => i.id === 2)!.a;
  assert.ok(a2.includes(formatMXN(planPrice('pro_month').totalCents)));
  assert.ok(a2.includes(formatMXN(planPrice('pro_year').totalCents)));

  const noTrial = faqItems(faqT, { ...opts, trialOffered: false }).map((i) => i.id);
  assert.deepEqual(noTrial, [2, 3, 4, 5, 6, 7, 8]);
  const noSignals = faqItems(faqT, {
    ...opts,
    tools: TOOLS.filter((x) => x.slug !== 'chalybcrypto'),
  }).map((i) => i.id);
  assert.deepEqual(noSignals, [1, 2, 3, 4, 5, 7, 8]);
  assert.equal(
    faqItems(faqT, { ...opts, claimAll: false }).find((i) => i.id === 5)!.a,
    es.landing.faq.a5NoClaim,
  );

  const page = faqPageData(all);
  assert.equal(page['@type'], 'FAQPage');
  assert.equal(page.mainEntity.length, 8);
  assert.deepEqual(page.mainEntity[0], {
    '@type': 'Question',
    name: all[0]!.q,
    acceptedAnswer: { '@type': 'Answer', text: all[0]!.a },
  });
});
