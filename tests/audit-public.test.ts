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
  const { parseInline, inlineText, parseMarkdown, blocksText } =
    await import('@/lib/legal/markdown');
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
    assert.ok(
      toc.every((e) => /^\d/.test(e.text)),
      `${doc}: ${toc.map((e) => e.text).join(' | ')}`,
    );
  }
  const tsx = read('src/components/legal/legal-markdown.tsx');
  assert.match(tsx, /legal-toc__plain/);
  assert.match(
    read('src/styles/chalyb-legal.css'),
    /\.legal-toc ol\.legal-toc__plain \{\s*list-style: none;/,
  );
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
    assert.doesNotMatch(
      read(p),
      /lastUpdated=\{t\('(doc\.)?(versionLine|reviewLine)'|lastUpdated=\{t\('policy'\)\}/,
      p,
    );
  }
});

test('Pro and VIP savings lines share one style (the accent chip)', () => {
  const src = read('src/components/app/billing/plan-cards.tsx');
  assert.doesNotMatch(src, /ch-pc__save/);
  assert.equal(
    src.match(/<span className="ch-pill ch-pill--acc">\s*\{t\('(pro|vip)\.save'/g)?.length,
    2,
  );
});

test('/planes FAQ uses the styled disclosure, not the browser default', () => {
  const src = read('src/components/app/billing/plans-view.tsx');
  assert.match(src, /className="ch-card ch-faq"/);
  const css = read('src/styles/chalyb-tokens.css');
  assert.match(css, /\.ch-faq summary \{ list-style: none;/);
  assert.match(css, /\.ch-faq summary::-webkit-details-marker \{ display: none; \}/);
});

test('contact form stores the lead before deciding the result; confirmation only on success', () => {
  const src = read('src/lib/contact/contact-actions.ts');
  const insert = src.indexOf(".from('partner_inquiries').insert(");
  const fail = src.indexOf("errorKey: 'sendFailed'");
  const confirm = src.indexOf("subject: 'Recibimos tu mensaje");
  assert.ok(insert > 0 && fail > insert, 'insert runs before the sendFailed return');
  assert.ok(confirm > fail, 'confirmation is sent only after the failure return');
  assert.match(src, /if \(!delivered && !stored\)/);
});

test('legal ARCO/terms routes treat a non-object JSON body (null) as {} instead of crashing', () => {
  for (const p of ['src/app/api/legal/arco/route.ts', 'src/app/api/legal/terms/route.ts']) {
    const src = read(p);
    assert.doesNotMatch(src, /req\.json\(\)\.catch\(\(\) => \(\{\}\)\)\) as Record/, p);
    assert.match(src, /raw && typeof raw === 'object' && !Array\.isArray\(raw\)/, p);
  }
});

test('takedown form maxLength matches the server limits (name was 500 vs 300)', async () => {
  const { TAKEDOWN_LIMITS } = await import('@/lib/legal/takedown');
  assert.equal(TAKEDOWN_LIMITS.claimantName, 300);
  const form = read('src/components/legal/takedown-form.tsx');
  assert.doesNotMatch(form, /maxLength=\{(4000|k === 'contentLocation')/);
  assert.equal(form.match(/maxLength=\{TAKEDOWN_LIMITS\[k\]\}/g)?.length, 2);
  assert.doesNotMatch(read('src/lib/legal/takedown-limits.ts'), /node:crypto/);
});

test('sitemap lists a /legal/* URL only when its document is in force (not noindex)', async () => {
  const src = read('src/app/sitemap.ts');
  assert.match(src, /doc === undefined \|\| inForce\(doc\)/);
  for (const p of [
    '/legal/terms',
    '/legal/privacy',
    '/legal/subscription',
    '/legal/acceptable-use',
    '/legal/packs',
  ])
    assert.ok(src.includes(`'${p}'`), p);
  const { inForce } = await import('@/lib/legal/in-force');
  // LEGAL_PUBLISH off in tests: nothing is "in force", and the sitemap is
  // just the always-public paths.
  assert.equal(inForce('paquetes'), false);
  const { default: sitemap } = await import('@/app/sitemap');
  const { PUBLIC_PATHS } = await import('@/lib/site');
  assert.equal(sitemap().length, PUBLIC_PATHS.length);
});
