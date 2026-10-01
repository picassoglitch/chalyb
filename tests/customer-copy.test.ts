// No technical jargon or old product names in customer copy (rebuild prompt
// §6.6, P0-7, P0-8). Every namespace in messages/*.json is customer-facing:
// the owner panel's strings live in its components, not in these files.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
