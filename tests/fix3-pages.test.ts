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
