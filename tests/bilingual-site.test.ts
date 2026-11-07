// Owner request 2026-11-07 — the site must work for English readers: toggle,
// saved choice, engine launch language, English tool names and emails.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localizedToolName } from '@/lib/engines/display-names';
import { accountLocale, engineUrlWithLang } from '@/lib/tools/routes';
import {
  chalitoResetCodeSubject,
  chalitoResetCodeTemplate,
  contactConfirmSubject,
  contactConfirmTemplate,
  emailLocale,
  packRefundedCopy,
  paymentReversedTemplate,
  paymentSuccessSubject,
  paymentSuccessTemplate,
  subscriptionActiveSubject,
  subscriptionActiveTemplate,
} from '@/lib/email/templates';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// Words that only show up when a Spanish sentence leaked into an English email.
const SPANISH = /\b(tu|tus|pago|cobro|correo|Recibimos|Retiramos|código|cuenta|mensaje)\b/;

test('tool names follow messages/en.json in English and stay as-is in Spanish', () => {
  assert.equal(localizedToolName('Señales', 'en'), 'Signals');
  assert.equal(localizedToolName('En vivo', 'en'), 'Live');
  assert.equal(localizedToolName('Clips', 'en'), 'Clips');
  assert.equal(localizedToolName('Chalito', 'en'), 'Chalito');
  assert.equal(localizedToolName('Señales', 'es'), 'Señales');
  assert.equal(localizedToolName('En vivo', null), 'En vivo');
  const en = read('messages/en.json');
  assert.doesNotMatch(en, /Señales|En vivo/, 'en.json names the tools in English');
});

test('the English landing no longer sells the product as Spanish-only', () => {
  const en = JSON.parse(read('messages/en.json')) as {
    landing: { hero: Record<string, string>; publicFooter: Record<string, string> };
  };
  for (const v of [...Object.values(en.landing.hero), ...Object.values(en.landing.publicFooter)])
    if (typeof v === 'string') assert.doesNotMatch(v, /^In Spanish|, in Spanish and/, v);
});

test('engine launch URL carries the hub language; unknown values are dropped', () => {
  const sso = 'https://clips.chalyb.com/auth/sso?token=abc.def&next=%2Fdashboard';
  const en = new URL(engineUrlWithLang(sso, 'en'));
  assert.equal(en.searchParams.get('lang'), 'en');
  assert.equal(en.searchParams.get('token'), 'abc.def', 'the signed token is untouched');
  assert.equal(en.searchParams.get('next'), '/dashboard');
  assert.equal(new URL(engineUrlWithLang(sso, 'es')).searchParams.get('lang'), 'es');
  assert.equal(engineUrlWithLang(sso, 'fr'), sso);
  assert.equal(engineUrlWithLang(sso, null), sso);
  assert.equal(engineUrlWithLang('not a url', 'en'), 'not a url');
  const route = read('src/app/auth/launch/[slug]/route.ts');
  // No lang (engine landings, Spanish screens) leaves the engine's own choice alone.
  assert.match(route, /NextResponse\.redirect\(engineUrlWithLang\(result\.url, lang\)\)/);
});

test('/account: the default URL follows the saved choice, /en/account stays English', () => {
  assert.equal(accountLocale('es', 'en'), 'en', 'signed in from / → the saved English');
  assert.equal(accountLocale('es', 'es'), 'es');
  assert.equal(accountLocale('es', undefined), 'es', 'no saved choice → the URL');
  assert.equal(accountLocale('es', 'fr'), 'es');
  assert.equal(accountLocale('en', 'es'), 'en', '/en is explicit and wins');
  assert.equal(accountLocale('en', null), 'en');
  // The saved choice is the toggle's cookie, never profiles.preferred_locale:
  // rows created before migration 0054 default to 'en' without anyone choosing it.
  const page = read('src/app/[locale]/(dashboard)/account/page.tsx');
  assert.match(page, /cookies\(\)\)\.get\(LANG_COOKIE\)/);
  assert.doesNotMatch(page, /preferred_locale/);
});

test('the language choice is saved: sign-up stores it, the in-app toggle stores it', () => {
  const signup = read('src/lib/billing/signup-consent.ts');
  assert.match(signup, /update\(\{ preferred_locale: input\.locale \}\)/);
  // Only for a brand-new account (after the "already recorded" return), and
  // only from the email form, which knows the page's language.
  assert.ok(signup.indexOf('preferred_locale') > signup.indexOf('if (existing) return'));
  assert.match(signup, /input\.surface === 'web_signup_email'/);
  const toggle = read('src/components/i18n/app-language-toggle.tsx');
  assert.match(toggle, /await setPreferredLocale\(target\)/);
  assert.match(toggle, /router\.replace\([^)]*\{ locale: target \}\)/);
  const action = read('src/lib/auth/locale-actions.ts');
  assert.match(action, /\.set\(LANG_COOKIE, locale,/);
  assert.match(read('src/lib/auth/profile-actions.ts'), /\.set\(LANG_COOKIE, input\.locale,/);
  assert.match(action, /^'use server';/);
  assert.match(action, /if \(!LOCALES\.includes\(locale\)\) return \{ ok: false \}/);
});

test('the toggle is visible: public header and both app headers', () => {
  assert.match(read('src/components/public/public-nav.tsx'), /<LanguageToggle /);
  const shell = read('src/components/app/app-shell.tsx');
  assert.match(shell, /<AppLanguageToggle \/>/, 'desktop sidebar');
  assert.match(shell, /<AppLanguageToggle compact \/>/, 'mobile header');
});

test('emailLocale: only "en" is English', () => {
  assert.equal(emailLocale('en'), 'en');
  assert.equal(emailLocale('es'), 'es');
  assert.equal(emailLocale(null), 'es');
  assert.equal(emailLocale('EN'), 'es');
});

test('customer emails: Spanish by default, English on request, links under /en', () => {
  const app = 'https://www.chalyb.com';
  const cases = [
    (l?: 'en') => contactConfirmTemplate({ name: 'Ana', subject: 'Hola', message: 'x', locale: l }),
    (l?: 'en') =>
      paymentSuccessTemplate({
        tier: 'Pro',
        amountMajor: '749.00',
        currency: 'MXN',
        paymentId: '1',
        appUrl: app,
        locale: l,
      }),
    (l?: 'en') =>
      subscriptionActiveTemplate({
        tier: 'Pro',
        amountMajor: '749.00',
        currency: 'MXN',
        nextChargeLabel: null,
        preapprovalId: 'p1',
        appUrl: app,
        locale: l,
      }),
    (l?: 'en') =>
      paymentReversedTemplate({
        reason: 'charged_back',
        what: '100 unused credits',
        amountMajor: '99.00',
        currency: 'MXN',
        paymentId: '2',
        appUrl: app,
        locale: l,
      }),
    (l?: 'en') => chalitoResetCodeTemplate({ code: '123456', locale: l }),
  ];
  for (const make of cases) {
    const es = make();
    assert.match(es.html, /<html lang="es">/);
    assert.match(es.html, /tu equipo de AI que trabaja solo/);
    assert.doesNotMatch(es.html, /chalyb\.com\/en\//);
    const en = make('en');
    assert.match(en.html, /<html lang="en">/);
    assert.match(en.html, /your AI team that works on its own/);
    // Text outside the user's own values (name/subject/message) is English.
    const body = en.html.replace(/<[^>]+>/g, ' ');
    assert.doesNotMatch(body, SPANISH, body.match(SPANISH)?.[0]);
    assert.doesNotMatch(en.text, SPANISH, en.text.match(SPANISH)?.[0]);
    for (const href of en.html.matchAll(/href="(https:\/\/www\.chalyb\.com[^"]*)"/g))
      assert.match(href[1]!, /^https:\/\/www\.chalyb\.com\/en\//, href[1]);
  }
  assert.equal(contactConfirmSubject(), 'Recibimos tu mensaje · Chalyb');
  assert.equal(contactConfirmSubject('en'), 'We got your message · Chalyb');
  assert.equal(subscriptionActiveSubject('Pro'), 'Tu plan Pro está activo · Chalyb');
  assert.equal(subscriptionActiveSubject('Pro', 'en'), 'Your Pro plan is active · Chalyb');
  assert.equal(chalitoResetCodeSubject('1', 'en'), 'Your Chalito code: 1');
});

test('email language comes from the page for request-time mail', () => {
  assert.match(read('src/lib/contact/contact-actions.ts'), /emailLocale\(formData\.get\('locale'\)\)/);
  assert.match(read('src/components/contact/contact-form.tsx'), /fd\.set\('locale', locale\)/);
  assert.match(read('src/components/tools/chalito/ResetDevices.tsx'), /reset\/start", \{ locale \}/);
  const reset = read('src/app/api/tools/chalito/reset/start/route.ts');
  assert.match(reset, /emailLocale\(body\?\.locale\)/);
  assert.match(reset, /sendResetCode\(to, code, locale\)/);
});

// Owner 2026-11-07: pre-0054 default-English profiles were reset to Spanish
// (20261107000200), so webhook/cron mail and Avisos follow the profile again.
test('webhook and cron mail and Avisos follow profiles.preferred_locale', () => {
  const sync = read('src/lib/payments/subscription-sync.ts');
  assert.match(sync, /const locale = await profileLocale\(userId\);/);
  assert.match(sync, /subscriptionActiveSubject\(TIER_CAPS\[tier\]\.label, locale\)/);
  assert.match(
    sync,
    /nextChargeLabel: nextPaymentDate \? formatFechaLarga\(nextPaymentDate, locale\)/,
  );
  assert.match(sync, /noticeText\('pastDue', \{\}, emailLocale\(profile\?\.preferred_locale\)\)/);
  assert.match(sync, /select\('email, full_name, preferred_locale'\)/);

  const oneOff = read('src/lib/payments/one-off-settlement.ts');
  assert.match(oneOff, /select\('email, tier, tier_ends_at, preferred_locale'\)/);
  assert.match(oneOff, /select\('email, tier, preferred_locale'\)/);
  assert.match(oneOff, /packRefundedCopy\(claw\.tokensRemoved, locale\)/);
  assert.match(oneOff, /paymentSuccessSubject\(TIER_CAPS\[confirmedTier\]\.label, locale\)/);
  assert.equal(oneOff.match(/^\s+locale,$/gm)?.length, 2, 'both templates get the locale');
  assert.doesNotMatch(oneOff, /créditos sin usar|está activo/, 'no Spanish literals left inline');

  const cron = read('src/app/api/cron/billing/route.ts');
  assert.match(cron, /select\('email, full_name, preferred_locale'\)/);
  assert.match(cron, /noticeText\(inApp\.kind, inApp\.vars, locale\)/);
  assert.match(cron, /fechaCobro: nextChargeAt \? formatFechaLarga\(nextChargeAt, locale\)/);

  assert.match(
    read('src/lib/tools/clips-jobs.ts'),
    /noticeText\(\s*'clipsReady',\s*\{ n: job\.clips\.length \},\s*await profileLocale\(job\.userId\),?\s*\)/,
  );
  const legal = read('src/lib/legal/legal-server.ts');
  for (const kind of ['arcoAnswered', 'contentRemoved', 'contentRestored'])
    assert.match(
      legal,
      new RegExp(`noticeText\\(\\s*'${kind}'[\\s\\S]{0,160}?profileLocale\\(`),
      kind,
    );

  // Every Avisos producer passes a language: no bare noticeText(kind[, vars]) call.
  for (const f of [
    'src/lib/payments/subscription-sync.ts',
    'src/lib/tools/clips-jobs.ts',
    'src/lib/legal/legal-server.ts',
    'src/app/api/cron/billing/route.ts',
  ])
    for (const call of read(f).matchAll(/noticeText\(([^()]|\([^()]*\))*\)/g))
      assert.match(call[0], /locale|Locale/, `${f}: ${call[0]}`);

  const helper = read('src/lib/notifications/user.ts');
  assert.match(helper, /select\('preferred_locale'\)/);
  assert.match(helper, /return emailLocale\(data\?\.preferred_locale\)/);
});

test('webhook subjects and copy have both languages; anything but en is Spanish', () => {
  assert.equal(paymentSuccessSubject('VIP'), 'Tu plan VIP está activo · Chalyb');
  assert.equal(paymentSuccessSubject('VIP', 'en'), 'Your VIP plan is active · Chalyb');
  assert.deepEqual(packRefundedCopy(100000), {
    subject: 'Pago reembolsado: retiramos los créditos sin usar del paquete · Chalyb',
    what: '100,000 créditos sin usar del paquete',
  });
  const en = packRefundedCopy(100000, 'en');
  assert.equal(en.what, '100,000 unused credits from the pack');
  assert.doesNotMatch(en.subject, SPANISH);
  for (const raw of [null, undefined, '', 'EN', 'fr', 'es']) assert.equal(emailLocale(raw), 'es');
  assert.equal(emailLocale('en'), 'en');
});
