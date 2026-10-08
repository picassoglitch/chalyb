// Audit 2026-10-08 (hub-core public/legal): regressions for the plain bugs
// fixed on the public site, legal pages and contact form.

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(p, 'utf8');

test('/legal has an index that redirects to the terms (was a 404)', () => {
  const p = 'src/app/[locale]/legal/page.tsx';
  assert.ok(existsSync(p));
  const src = read(p);
  assert.match(src, /from '@\/i18n\/routing'/);
  assert.match(src, /redirect\(\{ href: '\/legal\/terms', locale \}\)/);
});

test('footer language switch links both locales and keeps the page (was one link to /en)', () => {
  const footer = read('src/components/public/public-footer.tsx');
  assert.doesNotMatch(footer, /locale="en"/);
  assert.match(footer, /<LanguageSwitcher \/>/);
  const sw = read('src/components/i18n/language-switcher.tsx');
  assert.match(sw, /ORDER\.map/);
  assert.match(sw, /href=\{pathname as Route\}/);
  assert.match(sw, /locale=\{target\}/);
});
