// WS-4 · plan cards (PRICING-CARDS-SPEC §4.4, §8, §12.6, §16; K-1…K-9).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  proCard,
  superlativeAllowed,
  vipCard,
  type CardInput,
} from '@/lib/billing/plan-card-model';
import { planFeatures, storageLabel } from '@/lib/billing/plan-features';
import { plansCta } from '@/lib/billing/plans-cta';
import { pct, planPrice } from '@/config/pricing';
import { formatMXN } from '@/lib/billing/format';
import { trialCtaLabel } from '@/components/landing/links';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const es = JSON.parse(readFileSync(join(ROOT, 'messages/es.json'), 'utf8'));

function input(
  over: Partial<CardInput> & { flow?: boolean; trialUsed?: boolean; signedIn?: boolean } = {},
): CardInput {
  const flow = over.flow ?? true;
  const annualOffered = flow;
  return {
    cta: plansCta({
      signedIn: over.signedIn ?? false,
      isAdmin: false,
      flow,
      annualOffered,
      vipYearOffered: over.vipYearOffered ?? false,
      trialUsed: over.trialUsed ?? false,
      billing: null,
      quebecBlocked: false,
    }),
    trialOffered: over.trialOffered ?? (flow && !(over.trialUsed ?? false)),
    vipYearOffered: over.vipYearOffered ?? false,
    intervals: over.intervals ?? (annualOffered ? ['month', 'year'] : ['month']),
    current: over.current ?? null,
    badge: over.badge ?? 'recomendado',
  };
}

const TRIAL_KEYS = ['pro.cta', 'pro.note', 'pro.noteMonth'];

test('no trial wording when the trial is not offered', () => {
  for (const interval of ['year', 'month'] as const) {
    const c = proCard(input({ trialOffered: false, trialUsed: true, signedIn: true }), interval);
    assert.equal(c.chip, false);
    assert.ok(!TRIAL_KEYS.includes(c.ctaKey), c.ctaKey);
    assert.ok(!TRIAL_KEYS.includes(String(c.noteKey)), String(c.noteKey));
  }
});

test('trial offered: the chip in BOTH modes, "Empezar mis 7 días gratis", the dated note', () => {
  const year = proCard(input(), 'year');
  const month = proCard(input(), 'month');
  assert.equal(year.chip, true);
  assert.equal(month.chip, true);
  assert.equal(year.ctaKey, 'pro.cta');
  assert.equal(month.ctaKey, 'pro.cta');
  assert.equal(year.noteKey, 'pro.note');
  assert.equal(month.noteKey, 'pro.noteMonth');
  assert.equal(es.plans.pro.cta, 'Empezar mis 7 días gratis');
  assert.equal(es.plans.trialChip, '{dias} días gratis');
  assert.match(es.plans.pro.noteMonth, /\{fecha\} se cobran \{monto\} MXN y después cada mes/);
  assert.match(es.plans.pro.note, /por el año completo y se renueva cada año/);
});

test('annual mode: the yearly charge leads, Q5 reference line, accent savings pill', () => {
  const c = proCard(input(), 'year');
  assert.equal(c.amountCents, planPrice('pro_year').totalCents);
  assert.equal(c.unit, 'year');
  assert.equal(formatMXN(c.amountCents), '$9,970');
  assert.equal(c.monthlyRef, true);
  assert.equal(c.saveCents, 199_400);
  assert.equal(c.savePct, 16);
  assert.equal(c.referenceLine, false);
  assert.equal(es.billing.price.monthlyRef, 'o paga mes a mes: {monto} MXN al mes (plan mensual)');
});

test('monthly mode: no reference line to another plan, the reference/launch line, the switch link', () => {
  const c = proCard(input(), 'month');
  assert.equal(formatMXN(c.amountCents), '$997');
  assert.equal(c.monthlyRef, false);
  assert.equal(c.saveCents, 0);
  assert.equal(c.referenceLine, true);
  assert.equal(c.switchYear, true);
});

test('flow off (mockup 85): monthly only, "Elegir Pro mensual", charged today, no trial', () => {
  const i = input({ flow: false, signedIn: true });
  assert.deepEqual(i.intervals, ['month']);
  const c = proCard(i, 'month');
  assert.equal(c.chip, false);
  assert.equal(c.ctaKey, 'pro.ctaMonth');
  assert.equal(c.noteKey, 'notePaid');
  assert.equal(c.href, '/app/subscription');
  assert.equal(c.switchYear, false, 'no "al año" anywhere');
  assert.equal(es.plans.notePaid, 'Se cobra hoy. Cancela en 1 clic, sin llamadas.');
});

test('trial used: "Elegir Pro anual|mensual" straight to the paid checkout (PC-B5)', () => {
  const i = input({ trialUsed: true, signedIn: true });
  assert.equal(proCard(i, 'year').ctaKey, 'pro.ctaYear');
  assert.equal(proCard(i, 'year').href, '/app/prueba/pago?plan=pro_year');
  assert.equal(proCard(i, 'month').ctaKey, 'pro.ctaMonth');
});

test('badge: "Recomendado" by default, "Más popular" only with its flag, "Tu plan" wins; never "Mejor oferta"', () => {
  assert.equal(proCard(input(), 'year').badgeKey, 'pro.badge');
  assert.equal(proCard(input({ badge: 'masPopular' }), 'year').badgeKey, 'pro.badgePopular');
  assert.equal(proCard(input({ current: 'pro' }), 'year').badgeKey, 'yourPlan');
  assert.equal(es.plans.pro.badge, 'Recomendado');
  assert.equal(es.plans.pro.badgePopular, 'Más popular');
  const all = JSON.stringify(es) + readFileSync(join(ROOT, 'messages/en.json'), 'utf8');
  assert.doesNotMatch(all, /Mejor oferta|Best value/);
});

test('VIP: the trial for a first-time customer; "Solo plan mensual" until VIP anual is offered', () => {
  const c = vipCard(input(), 'year');
  assert.equal(c.noYear, true);
  assert.equal(c.unit, 'month');
  assert.equal(formatMXN(c.amountCents), '$3,799');
  assert.equal(c.chip, true);
  assert.equal(c.ctaKey, 'vip.ctaTrial');
  assert.equal(c.noteKey, 'pro.noteMonth');
  assert.equal(c.notePaid, false);
  // Trial used: no chip, the paid wording.
  const used = vipCard(input({ trialUsed: true, signedIn: true, trialOffered: false }), 'year');
  assert.equal(used.chip, false);
  assert.equal(used.ctaKey, 'vip.cta');
  const offered = input({
    vipYearOffered: true,
    trialUsed: true,
    signedIn: true,
    trialOffered: false,
  });
  const y = vipCard(offered, 'year');
  assert.equal(formatMXN(y.amountCents), '$36,325');
  assert.equal(y.savePct, 20);
  assert.equal(y.ctaKey, 'vip.ctaYear');
  assert.equal(vipCard(offered, 'month').switchYear, true);
});

test('C8 · no superlative deal claim unless Pro saves strictly the most', () => {
  assert.equal(pct('pro'), 16);
  assert.equal(pct('vip'), 20);
  assert.equal(
    superlativeAllowed(true),
    false,
    'with VIP anual at 20% nothing may say "best deal"',
  );
  const copy =
    readFileSync(join(ROOT, 'messages/es.json'), 'utf8') +
    readFileSync(join(ROOT, 'messages/en.json'), 'utf8');
  assert.doesNotMatch(copy, /Mejor oferta|Best value|la mejor opción|best deal/i);
});

test('K-9 · bullets come from TIER_CAPS, no tool count, no credits', () => {
  const keys = (t: 'FREE' | 'PRO' | 'VIP', on = true) =>
    planFeatures(t, { freeIncludesClips: on }).map((f) => [f.key, f.values ?? null, f.included]);
  assert.deepEqual(keys('FREE'), [
    ['clipsTry', null, true],
    ['history', { dias: 7 }, true],
    ['storage', { espacio: '500 MB' }, true],
    ['noStreams', null, false],
  ]);
  assert.deepEqual(keys('PRO'), [
    ['noWatermarkHd', null, true],
    // Credits govern volume, not a stream count (prod b770249).
    ['streamsUnlimited', null, true],
    ['history', { dias: 90 }, true],
    ['storage', { espacio: '5 GB' }, true],
    ['cancel', null, true],
  ]);
  assert.deepEqual(keys('VIP'), [
    ['clips4k', null, true],
    // Pro has unlimited streams too now, so VIP ("Todo lo de Pro, más:") doesn't repeat it.
    ['historyYear', null, true],
    ['storage', { espacio: '50 GB' }, true],
  ]);
  assert.equal(
    keys('FREE', false)[0]![0],
    'history',
    'no Clips bullet when FREE_INCLUDES_CLIPS is off',
  );
  assert.equal(storageLabel(500), '500 MB');
  assert.equal(storageLabel(50_000), '50 GB');
  const feat = JSON.stringify(es.plans.feat);
  assert.doesNotMatch(feat, /herramientas|crédit|créditos/i);
});

test('C15 · headline without a tool claim', () => {
  assert.equal(es.plans.title, 'Empieza gratis, crece con Pro');
  assert.doesNotMatch(es.plans.pro.tag, /herramientas/);
});

test('K-7 · trial labels outside the cards follow the flag', () => {
  assert.equal(trialCtaLabel({ trialFlowEnabled: true, signedIn: false }), 'cta');
  assert.equal(trialCtaLabel({ trialFlowEnabled: false, signedIn: false }), 'ctaNoTrial');
  assert.equal(trialCtaLabel({ trialFlowEnabled: true, signedIn: true }), 'ctaSignedIn');
  assert.equal(es.landing.ctaNoTrial, 'Empieza gratis');
  assert.equal(es.landing.ctaSignedIn, 'Ver planes');
  assert.doesNotMatch(es.meta.descriptionNoTrial, /gratis \d|prueba/i);
});

test('one shared component on both surfaces; old card CSS gone', () => {
  const view = readFileSync(join(ROOT, 'src/components/app/billing/plans-view.tsx'), 'utf8');
  const summary = readFileSync(join(ROOT, 'src/components/landing/plans-summary.tsx'), 'utf8');
  assert.match(view, /<PlanCards /);
  assert.match(summary, /<PlanCards /);
  const css =
    readFileSync(join(ROOT, 'src/styles/chalyb-tokens.css'), 'utf8') +
    readFileSync(join(ROOT, 'src/styles/chalyb-public.css'), 'utf8');
  assert.doesNotMatch(css, /\.ch-plancard|\.ch-plans\b|\.pub-pl\b|\.pub-pl__|\.pub-pl--/);
  assert.match(css, /grid-template-rows: subgrid/);
  assert.match(css, /clamp\(30px, 12\.2cqi, 46px\)/);
});

test('the savings pill is accent, never green (PC-B9)', () => {
  const cards = readFileSync(join(ROOT, 'src/components/app/billing/plan-cards.tsx'), 'utf8');
  const picker = readFileSync(join(ROOT, 'src/components/app/billing/trial-picker.tsx'), 'utf8');
  assert.doesNotMatch(cards + picker, /ch-pill--ok|kind="ok"/);
});

test('no "equivale", no reference line in checkout components', () => {
  for (const f of ['plan-cards.tsx', 'trial-picker.tsx', 'pay-form.tsx']) {
    const src = readFileSync(join(ROOT, 'src/components/app/billing', f), 'utf8');
    assert.doesNotMatch(src, /equivale|proYearEq|vsMonth/, f);
  }
});
