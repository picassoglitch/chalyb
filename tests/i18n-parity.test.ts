// Spanish first, English parity (rebuild prompt §6.1). Every customer string
// exists in both locales, is never empty, is actually translated, and keeps
// the same {placeholders}.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

type Tree = { [key: string]: string | Tree | string[] };

function load(locale: string): Record<string, string> {
  const raw = JSON.parse(
    readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'),
  ) as Tree;
  const out: Record<string, string> = {};
  const walk = (node: unknown, prefix: string) => {
    if (node !== null && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) walk(v, prefix ? `${prefix}.${k}` : k);
    } else {
      out[prefix] = String(node);
    }
  };
  walk(raw, '');
  return out;
}

const es = load('es');
const en = load('en');

/** Keys whose value is legitimately empty. */
const EMPTY_OK = new Set(['workspace.pages.fallback.sub']);

/** Keys whose value is legitimately the same word in both languages. */
const SAME_OK_KEYS = new Set([
  'plans.lealtad.yearMonthlySub', // "12 × {monto}"
  // FIX-3 §C.4: each language is written in its own language; city names and
  // the hour don't change.
  // Platform and product names, "Legal" and "Streamers" read the same.
  'landing.gallery.p1',
  'landing.gallery.p2',
  'landing.gallery.p3',
  'landing.who.streamers',
  'landing.publicFooter.legal',
  'landing.publicFooter.lang', // "Español · English": each language in its own
  'language.es',
  'language.en',
  'profile.tz.America_Tijuana',
  'profile.tz.America_Hermosillo',
  'profile.tz.America_Cancun',
  'profile.tz.Europe_Madrid',
  'profile.n.dailyHour',
  // Law §16.7: the US/CA footers exist only in English (USD market, flag off).
  'billing.price.taxUS',
  'billing.price.taxCA',
  'legal.eyebrow', // "Legal"
  'workspace.nav.planSuffix', // "plan"
  'workspace.settings.saveErrorPrefix', // "Error"
  'clips.s2.formats.vertical.detail', // "Vertical"
  'clips.s2.formats.horizontal.detail', // "Horizontal"
  'workspace.pages.fallback.sub', // empty
  'clips.done.thumbAlt', // "Clip: {title}"
  'invest.s1.exchange', // "Exchange"
  'results.clipsTitle', // "{n} clips"
  'admin.more.models', // "AI Models"
  'admin.more.analytics', // "Analytics"
  'admin.more.api', // "API & Keys"
  'admin.settings.authValue', // "Supabase Auth"
]);

/** Values that are names, prices or URLs and never translate. */
const SAME_OK_VALUES: RegExp[] = [
  /^(MXN )?\$[\d,.]+( MXN)?$/,
  /^https?:\/\//,
  /^(Pro|VIP|Plan|Chalyb|Clips|Señales|En vivo|YouTube|Twitch|Kick|Facebook|Instagram|WhatsApp|Internet|OBS|TikTok \/ Reels \/ Shorts)$/,
];

/** Pure templates — only placeholders, "MXN" and punctuation — read the same
 *  in both languages ("{monto} MXN · {fecha}"). */
const isTemplateOnly = (v: string) => v.replace(/\{\w+\}|MXN|[\s·•,.:()\-]/g, '') === '';

test('every key exists in both locales', () => {
  const onlyEs = Object.keys(es).filter((k) => !(k in en));
  const onlyEn = Object.keys(en).filter((k) => !(k in es));
  assert.deepEqual(onlyEs, [], 'keys missing from en.json');
  assert.deepEqual(onlyEn, [], 'keys missing from es.json');
});

test('no empty values', () => {
  const empty = Object.keys(es).filter(
    (k) => !EMPTY_OK.has(k) && ((es[k] ?? '').trim() === '' || (en[k] ?? '').trim() === ''),
  );
  assert.deepEqual(empty, []);
});

test('English is translated, not a copy of the Spanish', () => {
  const untranslated = Object.keys(es).filter(
    (k) =>
      k in en &&
      es[k] === en[k] &&
      !SAME_OK_KEYS.has(k) &&
      !SAME_OK_VALUES.some((re) => re.test(es[k]!)) &&
      !isTemplateOnly(es[k]!),
  );
  assert.deepEqual(untranslated, []);
});

test('placeholders match between locales', () => {
  const placeholders = (s: string) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();
  const mismatched = Object.keys(es).filter(
    (k) => k in en && placeholders(es[k]!).join() !== placeholders(en[k]!).join(),
  );
  assert.deepEqual(mismatched, []);
});

test('EN sign-out reads "Sign out" (B10)', () => {
  assert.equal(en['auth.account.signOut'], 'Sign out');
});
