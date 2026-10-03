// Public site (rebuild P4, BUILD-SPEC §8.1). Deploy-blocking: content derives
// from the active tools (P4-4), prices come from config (P4-1), owner
// decisions sit behind flags (P4-5), the idea form stores category 'idea'
// (P4-6), consent gates analytics (P4-7) and JSON-LD carries IVA totals (P4-8).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  activeTools,
  audienceCards,
  fallbackTools,
  heroRows,
  toolList,
  toPublicTool,
} from '@/lib/tools/public-tools';
import {
  TRIAL_SIGNUP_HREF,
  trialCtaHref,
  vipCtaHref,
  freeCtaHref,
} from '@/components/landing/links';
import { annualMath, planPrice } from '@/config/pricing';
import { formatMXN } from '@/lib/billing/format';
import { ideaRow, readIdeaForm, validateIdea } from '@/lib/contact/idea';
import { ALL, NECESSARY_ONLY, parseConsent, serializeConsent } from '@/lib/analytics/consent';
import { jsonLdData } from '@/lib/seo/json-ld';
import { partnerProgramTermsUrl, supportWhatsappUrl } from '@/lib/config/flags';

type Tree = { [key: string]: string | Tree };
const flat = (locale: string, prefix: string): Record<string, string> => {
  const raw = JSON.parse(
    readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'),
  ) as Tree;
  const out: Record<string, string> = {};
  const walk = (node: unknown, path: string) => {
    if (node !== null && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
    } else out[path] = String(node);
  };
  walk(raw, '');
  return Object.fromEntries(Object.entries(out).filter(([k]) => k.startsWith(prefix)));
};

// The legacy chrome on /contacto and /legal still reads these two.
const LEGACY = /^landing\.(nav|footer)\./;
const landing = (locale: string) =>
  Object.fromEntries(Object.entries(flat(locale, 'landing.')).filter(([k]) => !LEGACY.test(k)));

const rows = (active: string[], coming: string[] = []) => [
  ...active.map((slug) => ({ slug, status: 'active' })),
  ...coming.map((slug) => ({ slug, status: 'coming_soon' })),
];

// ---------- P4-4 · everything derives from the active tools ----------

test('active tools: only active, never hidden, in display order', () => {
  const tools = activeTools(
    rows(['chalybobs', 'chalybclip', 'chalybstream', 'chalybcrypto'], ['chalybbot', 'chalybpicks']),
  );
  assert.deepEqual(
    tools.map((t) => t.name),
    ['Clips', 'Señales', 'En vivo'],
  );
});

test('hero rows, audience cards and the tool list follow the active tools', () => {
  const three = fallbackTools();
  assert.deepEqual(
    heroRows(three).map((t) => t.slug),
    ['chalybclip', 'chalybcrypto', 'chalybobs'],
  );
  assert.deepEqual(audienceCards(three), ['streamers', 'creators', 'investors']);
  assert.equal(toolList(three, 'es'), 'Clips, Señales y En vivo');

  const all = activeTools(
    rows([
      'chalybclip',
      'chalybcrypto',
      'chalybobs',
      'chalybbot',
      'chalybpicks',
      'chalybrealtor',
      'chalybtrade',
    ]),
  );
  assert.equal(heroRows(all).length, 4, 'the panel shows at most 4 examples');
  assert.deepEqual(audienceCards(all), ['streamers', 'creators', 'business', 'investors']);

  const clipsOnly = [toPublicTool('chalybclip')];
  assert.deepEqual(
    audienceCards(clipsOnly),
    ['streamers', 'creators'],
    'no Negocios or investors card',
  );
});

test('every active tool has its landing copy in both locales', () => {
  for (const locale of ['es', 'en']) {
    const m = landing(locale);
    for (const tool of activeTools(
      rows([
        'chalybclip',
        'chalybcrypto',
        'chalybobs',
        'chalybbot',
        'chalybpicks',
        'chalybrealtor',
        'chalybtrade',
      ]),
    )) {
      assert.ok(m[`landing.tools.desc.${tool.slug}`], `${locale}: tools.desc.${tool.slug}`);
      assert.ok(m[`landing.hero.rows.${tool.slug}.label`], `${locale}: hero.rows.${tool.slug}`);
    }
  }
});

test('no hand-written tool counts, testimonials, user numbers or logos in the copy', () => {
  for (const locale of ['es', 'en']) {
    for (const [key, value] of Object.entries(landing(locale))) {
      assert.doesNotMatch(
        value,
        /\b(7|siete|seven)\s+(herramientas|tools)\b/i,
        `${key}: count must come from active tools`,
      );
      assert.doesNotMatch(value, /\d{2,}/, `${key}: no invented figures (${value})`);
      assert.doesNotMatch(
        value,
        /testimoni|reseñas|customer reviews|usuarios felices|happy (users|customers)|confían en nosotros|trusted by/i,
        key,
      );
    }
  }
});

// ---------- B31 + §0.3/§11 forbidden claims ----------

const FORBIDDEN = [
  /sin tarjeta de crédito/i,
  /simulaci[oó]n/i,
  /modo demo/i,
  /ver demo/i,
  /ChalyClip|ChalybClip|Chaly(Crypto|OBS|Bot|Picks|Realtor|Trade|StreamManager)/i,
  /\bengines?\b/i,
  /2 meses gratis|2 months free/i,
  /\bdisponible\b/i,
  /próximamente|coming soon/i,
  /\bbeta\b/i,
  /apuesta/i,
  /garantizad/i,
  /\btokens?\b/i,
];

test('landing copy has none of the forbidden claims (B31, §0.3, §11)', () => {
  for (const locale of ['es', 'en']) {
    for (const [key, value] of Object.entries(landing(locale))) {
      for (const re of FORBIDDEN) assert.doesNotMatch(value, re, `${locale} ${key}: ${value}`);
    }
  }
});

test('landing copy writes no amounts by hand (only $0 for the free month)', () => {
  for (const locale of ['es', 'en']) {
    for (const [key, value] of Object.entries(landing(locale))) {
      const amounts = value.match(/\$\s?\d[\d,]*(\.\d+)?/g) ?? [];
      assert.deepEqual(
        amounts.filter((a) => a !== '$0'),
        [],
        `${key}: ${value}`,
      );
    }
  }
});

test('landing components contain no amounts or struck-through prices', () => {
  const dir = new URL('../src/components/landing/', import.meta.url);
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.tsx'))) {
    const src = readFileSync(new URL(file, dir), 'utf8');
    assert.doesNotMatch(src, /\$\d/, `${file}: hard-coded amount`);
    assert.doesNotMatch(src, /line-through|<s>|<del>/, `${file}: struck-through price`);
  }
});

// ---------- P4-1 · prices and CTA targets ----------

test('the plan summary renders the config totals, IVA included', () => {
  delete process.env.PRICES_INCLUDE_IVA;
  assert.equal(formatMXN(planPrice('pro_year').totalCents), '$9,970');
  assert.equal(formatMXN(annualMath().yearSavingsCents), '$1,994');
  assert.equal(formatMXN(planPrice('vip_month').totalCents), '$3,799');
  const summary = readFileSync(
    new URL('../src/components/landing/plans-summary.tsx', import.meta.url),
    'utf8',
  );
  assert.match(summary, /tb\(props\.priceDisplay\.taxKey\)/, 'the plans block carries the tax footer');
  assert.match(summary, /<PlanCards /, 'the landing renders the same cards as /planes (K-1)');
  const cards = readFileSync(
    new URL('../src/components/app/billing/plan-cards.tsx', import.meta.url),
    'utf8',
  );
  assert.match(cards, /proCard\(model, interval\)/);
  const model = readFileSync(
    new URL('../src/lib/billing/plan-card-model.ts', import.meta.url),
    'utf8',
  );
  assert.match(model, /planPrice\(planKey\)\.totalCents/);
  assert.match(model, /annualMath\('pro'\)/);
});

test('the trial CTA follows TRIAL_FLOW_ENABLED', () => {
  assert.equal(trialCtaHref({ trialFlowEnabled: true, signedIn: false }), TRIAL_SIGNUP_HREF);
  assert.equal(TRIAL_SIGNUP_HREF, '/sign-in?mode=signup&intent=trial');
  assert.equal(
    trialCtaHref({ trialFlowEnabled: false, signedIn: false }),
    '/sign-in?mode=signup&plan=pro',
  );
  assert.equal(trialCtaHref({ trialFlowEnabled: true, signedIn: true }), '/planes');
  assert.equal(vipCtaHref(false), '/sign-in?mode=signup&plan=vip');
  assert.equal(freeCtaHref(true), '/app');
});

// ---------- P4-5 · owner decisions are flags ----------

test('WhatsApp help and partner terms need an https URL', () => {
  const saved = { w: process.env.SUPPORT_WHATSAPP_URL, p: process.env.PARTNER_PROGRAM_TERMS_URL };
  try {
    delete process.env.SUPPORT_WHATSAPP_URL;
    delete process.env.PARTNER_PROGRAM_TERMS_URL;
    assert.equal(supportWhatsappUrl(), null);
    assert.equal(partnerProgramTermsUrl(), null);
    process.env.SUPPORT_WHATSAPP_URL = 'javascript:alert(1)';
    assert.equal(supportWhatsappUrl(), null);
    process.env.SUPPORT_WHATSAPP_URL = 'https://wa.me/525500000000';
    assert.equal(supportWhatsappUrl(), 'https://wa.me/525500000000');
  } finally {
    if (saved.w === undefined) delete process.env.SUPPORT_WHATSAPP_URL;
    else process.env.SUPPORT_WHATSAPP_URL = saved.w;
    if (saved.p === undefined) delete process.env.PARTNER_PROGRAM_TERMS_URL;
    else process.env.PARTNER_PROGRAM_TERMS_URL = saved.p;
  }
});

test('the components gate each owner claim behind its flag', () => {
  const read = (f: string) =>
    readFileSync(new URL(`../src/components/landing/${f}`, import.meta.url), 'utf8');
  assert.match(read('audience.tsx'), /supportWhatsappUrl\(\) \? \['strip3'\]/);
  assert.match(read('faq.tsx'), /cfdiEnabled\(\) \?/);
  assert.match(read('faq.tsx'), /whatsapp \? t\('a2help'\)/);
  assert.match(read('partner.tsx'), /partnerProgramTermsUrl\(\)/);
  assert.match(read('json-ld.tsx'), /paidCheckoutEnabled\(\) && legalPublished\(\)/);
});

test('the partner section names no percentage or amount (D7)', () => {
  for (const locale of ['es', 'en']) {
    for (const [key, value] of Object.entries(flat(locale, 'landing.partner.'))) {
      assert.doesNotMatch(value, /%|\$|\d/, `${key}: ${value}`);
    }
  }
});

// ---------- P4-6 · idea form ----------

test('an idea is stored with category idea and no marketing opt-in', () => {
  const fd = new FormData();
  fd.set('name', ' Ana ');
  fd.set('email', 'Ana@Example.com');
  fd.set('idea', 'Una herramienta para agendar citas');
  fd.set('marketing', 'on');
  const input = readIdeaForm(fd);
  assert.equal(validateIdea(input), null);
  const row = ideaRow(input, { ip: '1.2.3.4', userAgent: 'test' });
  assert.equal(row.pane, 'idea');
  assert.deepEqual(row, {
    name: 'Ana',
    email: 'ana@example.com',
    message: 'Una herramienta para agendar citas',
    pane: 'idea',
    ip_addr: '1.2.3.4',
    user_agent: 'test',
  });
});

test('idea validation names the first bad field', () => {
  assert.equal(validateIdea({ name: 'A', email: 'a@b.co', idea: 'x'.repeat(20) }), 'name');
  assert.equal(validateIdea({ name: 'Ana', email: 'nope', idea: 'x'.repeat(20) }), 'email');
  assert.equal(validateIdea({ name: 'Ana', email: 'a@b.co', idea: 'corta' }), 'idea');
});

test('migration 0044 allows pane idea and re-runs cleanly', () => {
  const sql = readFileSync(
    new URL('../supabase/migrations/0044_idea_inquiries.sql', import.meta.url),
    'utf8',
  );
  assert.match(sql, /drop constraint if exists partner_inquiries_pane_check/);
  assert.match(sql, /'idea'/);
  assert.match(sql, /create index if not exists/);
});

// ---------- P4-7 · consent ----------

test('consent round-trips and an unknown or old value asks again', () => {
  assert.deepEqual(parseConsent(serializeConsent(ALL)), ALL);
  assert.deepEqual(parseConsent(serializeConsent(NECESSARY_ONLY)), NECESSARY_ONLY);
  assert.equal(parseConsent(''), null);
  assert.equal(parseConsent('v0.a1.p1'), null);
  assert.equal(parseConsent('yes'), null);
});

test('the cookie banner text is the exact aceptacion-ux §9 sentence', () => {
  assert.equal(
    flat('es', 'landing.cookies.')['landing.cookies.text'],
    'Usamos cookies necesarias para que Chalyb funcione y, si aceptas, cookies de analítica y publicidad para mejorar y medir campañas.',
  );
});

test('Vercel Analytics mounts only through the consent gate', () => {
  const layout = readFileSync(new URL('../src/app/[locale]/layout.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(layout, /<Analytics\b/);
  assert.match(layout, /<CookieConsent \/>/);
  const banner = readFileSync(
    new URL('../src/components/public/cookie-banner.tsx', import.meta.url),
    'utf8',
  );
  assert.match(banner, /\{consent\?\.analytics && <Analytics \/>\}/);
});

// ---------- P4-8 · JSON-LD ----------

test('JSON-LD offers are the IVA-inclusive MXN totals', () => {
  delete process.env.PRICES_INCLUDE_IVA;
  const data = jsonLdData('https://www.chalyb.com');
  const product = data['@graph'][1] as {
    offers: Array<{
      price: string;
      priceCurrency: string;
      priceSpecification: { valueAddedTaxIncluded: boolean };
    }>;
  };
  assert.deepEqual(
    product.offers.map((o) => o.price),
    ['9970.00', '997.00', '3799.00'],
  );
  for (const o of product.offers) {
    assert.equal(o.priceCurrency, 'MXN');
    assert.equal(o.priceSpecification.valueAddedTaxIncluded, true);
  }
});
