// WS-9 · FIX-3: Mi plan, Mis créditos, Mi perfil on the new design system
// (FIX-3-PAGINAS-SPEC §4). Content and source checks; the rendered checks
// live in e2e/fix3.spec.ts.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const src = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const es = JSON.parse(src('messages/es.json'));
/** Every string value of a message subtree (keys are not copy). */
const values = (o: unknown): string[] =>
  typeof o === 'string' ? [o] : o && typeof o === 'object' ? Object.values(o).flatMap(values) : [];

// §4.4 group 1–2: no legacy theme, monospace, uppercase or small inline type.
const LEGACY =
  /cc-mod-|cc-scroll|cc-bar-(track|fill)|cc-shell|ch-legacy|--cc-|monospace|textTransform|text-transform|fontSize: *1[0-5](\.[0-9])?\b|#f5b1|#f5b9|#e8c2|#070809/;
// §4.4 group 3: dev glyphs and words that must not reach the screen.
const BANNED =
  /▸|◆|●|◷|telemetry|paso 05|profiles\.tier|Vercel|TOTP|Super Admin|\bengines?\b|\btokens?\b|Top-up|LLM|EL MÁS ELEGIDO|1 herramienta incluida|nunca caducan|dangerouslySetInnerHTML/i;
const FREE_AS_PLAN = /\bFree\b/;

test('A · Mi plan: one view for /app/billing and /app/subscription, no legacy shell', () => {
  const sub = src('src/app/[locale]/(dashboard)/app/subscription/page.tsx');
  const bill = src('src/app/[locale]/(dashboard)/app/billing/page.tsx');
  assert.match(sub, /<MiPlanView/);
  assert.match(bill, /<MiPlanView/);
  assert.match(sub, /syncSubscription\(/, 'the MP return sync stays');
  assert.match(sub, /redirect\(\{ href: `\/app\/billing\$\{qs\}`/, 'paid states → /app/billing, keeping status');
  for (const f of [
    'src/app/[locale]/(dashboard)/app/subscription/page.tsx',
    'src/components/app/billing/free-plan.tsx',
    'src/components/app/billing/mi-plan-view.tsx',
  ]) {
    const code = src(f);
    assert.doesNotMatch(code, LEGACY, f);
    // Strings only (comments may name internals).
    const strings = (code.match(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g) ?? []).join('\n');
    assert.doesNotMatch(strings.replace(/import[^\n]*/g, ''), /▸|●|telemetry|profiles\.tier|EL MÁS ELEGIDO/, f);
  }
});

test('A · the copy: no amounts written by hand, no banned words, the real charge as the big number', () => {
  const copy = values([es.freeplan, es.myplan]).join('\n');
  assert.doesNotMatch(copy, /\$\s?\d/, 'amounts come from config/pricing.ts');
  assert.doesNotMatch(copy, BANNED);
  assert.doesNotMatch(copy, FREE_AS_PLAN);
  assert.doesNotMatch(copy, /2 meses gratis|mes gratis|equivale/i);
  assert.equal(es.freeplan.price.monthUnit, 'MXN al mes');
  assert.match(es.freeplan.legal, /Precios en MXN, IVA incluido\./);
  // Owner 2026-10-03: the trial is on every plan for a first-time customer,
  // so "VIP no tiene prueba" is not said.
  assert.doesNotMatch(es.freeplan.choiceNote, /VIP no tiene prueba/);
  const free = src('src/components/app/billing/free-plan.tsx');
  assert.match(free, /planPrice\('pro_month'\)\.totalCents/);
  assert.match(free, /'\/app\/prueba\?interval=month'/, 'Pro mensual preselected, never the annual');
  assert.match(free, /PRICING\.credits\.pro \?\? null/, 'plan credit lines only when config sets them (D-F3-2)');
});

test('B · Mis créditos: no legacy, no technical words on screen, packs from config', () => {
  const page = src('src/app/[locale]/(dashboard)/app/usage/page.tsx');
  assert.doesNotMatch(page, LEGACY);
  assert.match(page, /balanceBroken \? \(/, 'a broken balance paints no number (§4.2 B)');
  // The owner's pack prices (Ajustes), never a typed list.
  assert.match(page, /pricedPacks\.map/);
  assert.match(page, /await loadPricedPacks\(\)/);
  const sheet = src('src/components/app/credits-sheet.tsx');
  assert.match(sheet, /packs\[Math\.min\(1, packs\.length - 1\)\]/, 'the middle pack is preselected');
  assert.match(sheet, /\/app\/usage\/checkout\?pack=\$\{chosen\.id\}/);
  // §4.2 B: none of these words in the normal view's copy.
  const copy = values(es.credits).filter((s) => !/\[\/app\/usage\]/.test(s)).join('\n');
  assert.doesNotMatch(copy, /\btokens?\b|\bengines?\b|\brun\b|llamada|LLM|Storage|Publish|telemetry|balance|bonus|Top-up/i);
  // "Suscripción" as the old screen's name; the sheet's "no una suscripción" is the spec's own copy.
  assert.doesNotMatch(copy, /Suscripción/);
  assert.doesNotMatch(copy, /\$\s?\d|% de descuento|nunca caducan|Mejor relación/);
  assert.equal(es.credits.sheet.cta, 'Continuar al pago · {monto} MXN');
});

test('C · Mi perfil: server values, one save action, real controls only', () => {
  const page = src('src/app/[locale]/(dashboard)/app/settings/perfil/page.tsx');
  const form = src('src/components/app/profile-form.tsx');
  const action = src('src/lib/auth/profile-actions.ts');
  assert.doesNotMatch(page + form, LEGACY);
  assert.doesNotMatch(form, /dangerouslySetInnerHTML|TOTP|mfa|2FA/i, 'no fake security switch');
  assert.match(form, /localStorage\.removeItem\(LEGACY_KEY\)/, 'the browser-only prefs are dropped');
  assert.doesNotMatch(form, /localStorage\.getItem/, 'values never come from the browser');
  assert.match(page, /showNotifications=\{profileNotificationPrefs\(\)\}/, 'D-F3-5');
  // One client, one write; redirect only on a language change; no DB text.
  assert.equal((action.match(/createClient\(\)/g) ?? []).length, 1);
  assert.match(action, /if \(input\.locale !== input\.currentLocale\) \{\s*\/\/[\s\S]*?redirect\(/);
  assert.doesNotMatch(action, /error\.message \}/);
  assert.match(action, /'marketing_opt_in' : 'marketing_opt_out'/, 'consent is an event, never a column');
  const mig = src('supabase/migrations/0054_profile_prefs.sql');
  assert.match(mig, /alter column preferred_locale set default 'es'/);
  assert.match(mig, /grant update \(timezone, notify_critical, notify_daily, notify_viral\)/);
  assert.equal(es.language.es, 'Español (México)');
  assert.equal(es.profile.saved, 'Listo, guardamos tus cambios.');
});
