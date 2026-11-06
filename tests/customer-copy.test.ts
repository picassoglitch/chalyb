// No technical jargon or old product names in customer copy (rebuild prompt
// §6.6, P0-7, P0-8). Every namespace in messages/*.json is customer-facing:
// the owner panel's strings live in its components, not in these files.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FORBIDDEN: { label: string; re: RegExp }[] = [
  { label: 'engine', re: /engine/i },
  { label: 'tier', re: /\btiers?\b/i },
  { label: 'SSO', re: /\bSSO\b/ },
  { label: 'token', re: /token/i },
  { label: 'slug', re: /\bslug/i },
  { label: 'placeholder', re: /placeholder/i },
  { label: 'webhook', re: /webhook/i },
  { label: 'simulación', re: /simulaci[oó]n|simulation/i },
  { label: 'modo demo', re: /modo demo|demo mode/i },
  { label: 'admin_api_base', re: /admin_api_base/ },
  { label: 'engine_subs', re: /engine_subs/ },
  { label: '_ADMIN_TOKEN', re: /_ADMIN_TOKEN/ },
  { label: 'Vercel', re: /Vercel/ },
  { label: 'Supabase', re: /Supabase/ },
  { label: 'Chaly* product names', re: /Chaly(?!b\b)[A-Za-z]+/ },
  { label: 'Disponible as a state', re: /^Disponible$|Requiere Pro/ },
  { label: 'próximamente / beta', re: /pr[oó]ximamente|coming soon|\bbeta\b/i },
  { label: 'configuración incompleta', re: /configuración quedó incompleta/ },
];

function strings(locale: string): [string, string][] {
  const raw = JSON.parse(
    readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'),
  );
  const out: [string, string][] = [];
  const walk = (node: unknown, prefix: string) => {
    if (node !== null && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) walk(v, prefix ? `${prefix}.${k}` : k);
    } else {
      out.push([prefix, String(node)]);
    }
  };
  walk(raw, '');
  return out;
}

for (const locale of ['es', 'en']) {
  test(`messages/${locale}.json has no forbidden customer terms`, () => {
    const hits: string[] = [];
    for (const [key, value] of strings(locale)) {
      // The owner panel may name things technically (rebuild P5: "Technical
      // labels are allowed in admin"); customers never see admin.*.
      if (key.startsWith('admin.')) continue;
      for (const { label, re } of FORBIDDEN) {
        if (re.test(value)) hits.push(`${key} (${label}): ${value}`);
      }
    }
    assert.deepEqual(hits, []);
  });
}

test('the forbidden-name rule still allows the "Chalyb" wordmark', () => {
  const rule = FORBIDDEN.find((f) => f.label === 'Chaly* product names')!.re;
  assert.equal(rule.test('Chalyb Pro'), false);
  assert.equal(rule.test('ChalyClip'), true);
  assert.equal(rule.test('ChalybClip'), true);
});

// Owner 2026-11-06: our streaming product is "Chalyb" / "En vivo", never an
// OBS-branded name. OBS Studio (the app people stream from) stays.
const OLD_BRAND = /chaly\w*\s?obs/gi;
// The slug `chalybobs` and env vars `CHALYBOBS_*` are identifiers, not brand.
function oldBrandHits(text: string): string[] {
  return (text.match(OLD_BRAND) ?? []).filter(
    (m) => m !== m.toLowerCase() && m !== m.toUpperCase(),
  );
}

test('the old-brand rule spares identifiers and OBS Studio', () => {
  for (const bad of ['ChalyOBS', 'ChalybOBS', 'Chalyb OBS', 'ChalyObs', 'Chalyobs'])
    assert.deepEqual(oldBrandHits(`Entrar a ${bad}`), [bad]);
  for (const ok of ['chalybobs', 'CHALYBOBS_SSO_SECRET', 'OBS Studio', 'Chalyb En vivo'])
    assert.deepEqual(oldBrandHits(ok), []);
});

for (const locale of ['es', 'en']) {
  test(`messages/${locale}.json never names the product with OBS (admin included)`, () => {
    const hits = strings(locale).flatMap(([k, v]) => oldBrandHits(v).map((m) => `${k}: ${m}`));
    assert.deepEqual(hits, []);
  });
}

test('src/ shows no OBS-branded product name outside comments', () => {
  const hits: string[] = [];
  const root = fileURLToPath(new URL('../src/', import.meta.url));
  for (const rel of readdirSync(root, { recursive: true }) as string[]) {
    if (!/\.(tsx?|mjs)$/.test(rel)) continue;
    readFileSync(join(root, rel), 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line)) return;
        const code = line.replace(/\s\/\/\s.*$/, '');
        for (const m of oldBrandHits(code)) hits.push(`src/${rel}:${i + 1}: ${m}`);
      });
  }
  assert.deepEqual(hits, []);
});
