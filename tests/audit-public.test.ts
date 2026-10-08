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

test('legal markdown renders `code` spans instead of showing raw backticks', async () => {
  const { parseInline, inlineText, parseMarkdown, blocksText } = await import('@/lib/legal/markdown');
  assert.deepEqual(parseInline('ver `chalyb.com/quien-vende` hoy'), [
    { t: 'text', v: 'ver ' },
    { t: 'code', v: 'chalyb.com/quien-vende' },
    { t: 'text', v: ' hoy' },
  ]);
  assert.equal(inlineText(parseInline('**a `b*c` d**')), 'a b*c d');
  // An unmatched backtick stays literal.
  assert.equal(inlineText(parseInline('a ` b')), 'a ` b');
  assert.doesNotMatch(blocksText(parseMarkdown('Por ejemplo, `chalyb.com/terminos/v1-0`.')), /`/);
});

test('legal TOC is not numbered twice when headings carry their own numbers', async () => {
  const { parseMarkdown, inlineText } = await import('@/lib/legal/markdown');
  // Same as tocEntries() in legal-markdown.tsx (a .tsx file node can't load).
  const tocEntries = (list: ReturnType<typeof parseMarkdown>) =>
    list.flatMap((b) => (b.t === 'h' && b.level === 2 ? [{ text: inlineText(b.c) }] : []));
  const { renderedSource, LEGAL_DOCS } = await import('@/lib/legal/registry');
  // Every current legal doc numbers its sections, so the plain list applies.
  for (const doc of LEGAL_DOCS) {
    const src = renderedSource(doc);
    if (src === null) continue;
    const toc = tocEntries(parseMarkdown(src));
    assert.ok(toc.every((e) => /^\d/.test(e.text)), `${doc}: ${toc.map((e) => e.text).join(' | ')}`);
  }
  const tsx = read('src/components/legal/legal-markdown.tsx');
  assert.match(tsx, /legal-toc__plain/);
  assert.match(read('src/styles/chalyb-legal.css'), /\.legal-toc ol\.legal-toc__plain \{\s*list-style: none;/);
});

test('legal prose does not use overflow-wrap:anywhere (broke table words mid-word on phones)', () => {
  const css = read('src/styles/chalyb-legal.css');
  assert.doesNotMatch(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /\.legal-prose \.legal-table \{\s*overflow-x: auto;/);
});

test('"Última actualización" label only precedes an actual date', () => {
  const page = read('src/components/legal/legal-page.tsx');
  assert.match(page, /lastUpdated \?/);
  for (const p of [
    'src/components/legal/legal-changes-page.tsx',
    'src/components/legal/legal-doc-page.tsx',
    'src/app/[locale]/derechos-de-autor/page.tsx',
  ]) {
    assert.doesNotMatch(read(p), /lastUpdated=\{t\('(doc\.)?(versionLine|reviewLine)'|lastUpdated=\{t\('policy'\)\}/, p);
  }
});
