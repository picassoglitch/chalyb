// WS-12 · legal pages, versions, the publish gate and re-acceptance
// (old P6-1/2/3/5; aceptacion-ux §8, §11 "Documentos versionados con URL
// fija y hash").

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { blocksText, parseMarkdown } from '@/lib/legal/markdown';
import { AMOUNT_RE, bindAmounts, tokenizeAmounts } from '@/lib/legal/amounts';
import {
  LEGAL_DOCS,
  PLACEHOLDER_RE,
  archived,
  currentVersion,
  legalPath,
  legalPublishBlockers,
  listVersions,
  parseVersionSlug,
  placeholders,
  renderedSource,
  versionMeta,
  versionSlug,
} from '@/lib/legal/registry';
import { legalDocument } from '@/lib/legal/documents';
import { LEGAL_PAGES } from '@/lib/legal/public-pages';
import {
  compareVersions,
  termsHistory,
  termsModalExempt,
  termsPrompt,
  type TermsHistory,
} from '@/lib/legal/reaccept';
import {
  legalPublished,
  legalPublishBlockers as flagBlockers,
  paidCheckoutBlockers,
} from '@/lib/config/flags';
import publishState from '@/lib/legal/publish-state.json' with { type: 'json' };
import registryJson from '@/lib/legal/registry.json' with { type: 'json' };
import hashes from '@/lib/legal/document-hashes.json' with { type: 'json' };

const ROOT = new URL('../', import.meta.url).pathname;
const LAW = join(ROOT, 'docs/design/app-reimagine/legal');
const lawSource = (doc: string) =>
  readFileSync(join(LAW, (registryJson as Record<string, { file: string }>)[doc]!.file), 'utf8');
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

function withEnv(env: Record<string, string | undefined>, fn: () => void) {
  const prev = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  const apply = (vals: Record<string, string | undefined>) => {
    for (const [k, v] of Object.entries(vals)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
  apply(env);
  try {
    fn();
  } finally {
    apply(prev);
  }
}

// ── Markdown ──────────────────────────────────────────────────────────────

test('markdown: headings, quotes, lists, tables, inline marks, escapes', () => {
  const b = parseMarkdown(
    '# Título\n\n> **Resumen**\n>\n> - uno\n> - dos\n\n## 1. Planes\n\n| Plan | Precio |\n|---|---|\n| **Pro** | $997 |\n\n1. a\n2. *b*\n\n\\*Nota [x](/legal/terms) [y](javascript:alert(1))\n\n---',
  );
  assert.deepEqual(
    b.map((x) => x.t),
    ['h', 'quote', 'h', 'table', 'ol', 'p', 'hr'],
  );
  assert.equal(b[2]!.t === 'h' && b[2]!.id, '1-planes');
  const text = blocksText(b);
  assert.match(text, /Pro \| \$997/);
  assert.match(text, /^\*Nota x \[y\]\(javascript:alert\(1\)\)$/m, 'unsafe links stay text');
});

test('markdown: every Law document parses to the same visible text it holds', () => {
  for (const doc of LEGAL_DOCS) {
    const text = blocksText(parseMarkdown(lawSource(doc)));
    // No Markdown syntax leaks into the page.
    assert.doesNotMatch(text, /\*\*|^#{1,4} |^> /m, doc);
    assert.ok(text.length > 4000, doc);
  }
});

// ── Versions, archive, hashes ─────────────────────────────────────────────

test('archive: each current version is Law’s file byte for byte, with its sha256', () => {
  for (const doc of LEGAL_DOCS) {
    const a = archived(doc);
    assert.ok(a, `${doc} archived — run pnpm legal:hash`);
    const src = lawSource(doc);
    assert.equal(a.source, src, `${doc}: docs changed since the archive — run pnpm legal:hash`);
    assert.equal(a.sha256, sha(src), doc);
    assert.equal((hashes as Record<string, string>)[doc], a.sha256, `${doc} document-hashes.json`);
  }
});

test('archive: every version listed in the registry has its module', () => {
  for (const doc of LEGAL_DOCS) {
    assert.ok(listVersions(doc).includes(currentVersion(doc)), doc);
    for (const v of listVersions(doc)) {
      const a = archived(doc, v)!;
      assert.equal(a.sha256, sha(a.source), `${doc}@${v} archive is self-consistent`);
    }
  }
});

test('versioned URL: fixed /legal/<slug>/v<x-y>, stable for a version', () => {
  delete process.env.NEXT_PUBLIC_CANONICAL_ORIGIN;
  const d = legalDocument('suscripcion');
  assert.equal(d.url, `https://www.chalyb.com/legal/subscription/${versionSlug(d.version)}`);
  assert.equal(d.sha256, archived('suscripcion')!.sha256);
  assert.equal(parseVersionSlug('v1-0'), '1.0');
  assert.equal(parseVersionSlug('v12-3'), '12.3');
  assert.equal(parseVersionSlug('1.0'), null);
  assert.equal(parseVersionSlug('v1-0;drop'), null);
});

// ── Amounts from config (old P6-2) ────────────────────────────────────────

const amountRoles = (doc: string) =>
  (
    registryJson as Record<
      string,
      { current: string; versions: Record<string, { amountRoles?: Record<string, string[]> }> }
    >
  )[doc]!.versions[currentVersion(doc as never)]!.amountRoles ?? {};

test('amounts: every amount Law wrote is one config role, none typed', () => {
  for (const doc of LEGAL_DOCS) {
    const { template, unknown, ambiguous, invalid } = tokenizeAmounts(
      lawSource(doc),
      amountRoles(doc),
      false,
    );
    assert.deepEqual([unknown, ambiguous, invalid], [[], [], []], doc);
    assert.equal(
      [...template.matchAll(AMOUNT_RE)].length,
      0,
      `${doc} template has no literal amount`,
    );
    assert.equal(template, archived(doc)!.template, `${doc} archived template current`);
  }
});

test('amounts: an amount two roles share is never guessed', () => {
  // Pro mensual and Lealtad month 5 are both $997 today.
  const r = tokenizeAmounts('Pro $997 · mes 5 $997', {}, false);
  assert.equal(r.ambiguous.length, 1);
  assert.throws(() => tokenizeAmounts('Pro $997', {}), /ambiguous/);
  assert.throws(
    () => tokenizeAmounts('$997 y $997', { $997: ['mxn:pro_month'] }),
    /ambiguous/,
    'count must match',
  );
  assert.throws(() => tokenizeAmounts('$997', { $997: ['mxn:vip_month'] }), /wrong role/);
  assert.equal(
    tokenizeAmounts('Pro $997 · mes 5 $997', { $997: ['mxn:pro_month', 'mxn:lealtad_4'] }).template,
    'Pro {{mxn:pro_month}} · mes 5 {{mxn:lealtad_4}}',
  );
});

test('amounts: under today’s config the render equals Law’s text, and the hash is of that render', () => {
  for (const doc of LEGAL_DOCS) {
    assert.equal(renderedSource(doc), lawSource(doc), doc);
    assert.equal(archived(doc)!.rendered, lawSource(doc), `${doc} archived render current`);
    assert.equal(archived(doc)!.sha256, sha(archived(doc)!.rendered), doc);
  }
});

test('amounts: a price change re-renders a draft, never the Lealtad month-5 cell', () => {
  withEnv({ PRICES_INCLUDE_IVA: 'false' }, () => {
    const text = renderedSource('suscripcion')!;
    // $997 as a list price + 16% IVA.
    assert.match(text, /\*\*Pro \$1,156\.52 MXN\/mes\*\*/);
    // Lealtad steps don't move with the IVA flag: month 5 stays $997.
    assert.match(text, /\| 5 \| \*\*\$997 MXN\*\* \| 40% \|/);
    assert.match(text, /\$1,163 · \$997 · \$831/);
  });
  assert.equal(bindAmounts('{{mxn:pro_month}} · {{usd:pro_year}}'), '$997 · US$500');
});

test('amounts: a published version is frozen: today’s prices never change it', () => {
  const a = archived('suscripcion')!;
  const frozen = { ...a, rendered: a.rendered };
  withEnv({ PRICES_INCLUDE_IVA: 'false' }, () => {
    // What renderedSource does for a published version: the archived render.
    assert.equal(frozen.rendered, lawSource('suscripcion'));
    assert.notEqual(
      bindAmounts(a.template),
      frozen.rendered,
      'the archive step would refuse: new version needed',
    );
  });
  const reg = readFileSync(join(ROOT, 'src/lib/legal/registry.ts'), 'utf8');
  assert.match(
    reg,
    /versionMeta\(doc, version\)\?\.published \? a\.rendered : bindAmounts\(a\.template\)/,
  );
  const script = readFileSync(join(ROOT, 'scripts/hash-legal-docs.mjs'), 'utf8');
  assert.match(script, /today's prices render it differently/);
});

// ── Publish gate (old P6-3) ───────────────────────────────────────────────

test('placeholders: the regex catches Law’s owner brackets, not prose', () => {
  const hits = (s: string) => [...s.matchAll(PLACEHOLDER_RE)].map((m) => m[0]);
  assert.deepEqual(hits('[RAZÓN SOCIAL], RFC [RFC], [IVA: CONFIRMAR] y [DÍAS DE GRACIA]'), [
    '[RAZÓN SOCIAL]',
    '[RFC]',
    '[IVA: CONFIRMAR]',
    '[DÍAS DE GRACIA]',
  ]);
  assert.deepEqual(hits('[DECISIÓN DEL DUEÑO D20: si $9,970 es precio de primer año]').length, 1);
  // Numbers and lowercase choices count too (7a review): [30], [15],
  // [conservarás / tendrás limitado].
  assert.deepEqual(hits('dentro de [30] días, [15] hábiles, [conservarás / tendrás limitado]'), [
    '[30]',
    '[15]',
    '[conservarás / tendrás limitado]',
  ]);
  // The regex runs on rendered text: a Markdown link is already plain text.
  assert.deepEqual(hits(blocksText(parseMarkdown('ver [sección 4](#planes)'))), []);
});

test('placeholders: today’s drafts would fail as "published"', () => {
  for (const doc of LEGAL_DOCS)
    assert.ok(placeholders(doc).length > 0, `${doc} still has brackets`);
  assert.ok(placeholders('terminos').includes('[RAZÓN SOCIAL]'));
  assert.ok(placeholders('suscripcion').includes('[IVA: CONFIRMAR]'));
  assert.ok(placeholders('suscripcion').includes('[conservarás / tendrás limitado]'));
  assert.ok(placeholders('terminos').includes('[30]'));
  assert.ok(placeholders('terminos').includes('[15]'));
  assert.ok(legalPublishBlockers().length > 0);
});

test('publish gate: LEGAL_PUBLISH=true cannot take effect while a blocker remains', () => {
  withEnv({ LEGAL_PUBLISH: 'true' }, () => {
    assert.equal(legalPublished(), false);
    assert.ok(paidCheckoutBlockers().includes('LEGAL_PUBLISH'));
  });
  withEnv({ LEGAL_PUBLISH: undefined }, () => assert.equal(legalPublished(), false));
});

test('publish gate: flags.ts reads the same state the registry computes', () => {
  // publish-state.json is generated by pnpm legal:hash; stale = run it again.
  for (const doc of LEGAL_DOCS) {
    const s = (
      publishState as Record<string, { version: string; published: boolean; placeholders: number }>
    )[doc]!;
    assert.equal(s.version, currentVersion(doc), doc);
    assert.equal(s.published, Boolean(versionMeta(doc)?.published), doc);
    assert.equal(s.placeholders, placeholders(doc).length, doc);
  }
  const fromRegistry = legalPublishBlockers().filter((b) => !b.endsWith(':not-archived'));
  assert.deepEqual(flagBlockers(), fromRegistry);
});

test('publish gate: no version is marked published while it has brackets', () => {
  for (const doc of LEGAL_DOCS) {
    for (const v of listVersions(doc)) {
      if (versionMeta(doc, v)?.published) assert.deepEqual(placeholders(doc, v), [], `${doc}@${v}`);
    }
  }
});

// ── Routes, links, redirects ──────────────────────────────────────────────

const APP = join(ROOT, 'src/app/[locale]');
const pageAt = (path: string) => existsSync(join(APP, path, 'page.tsx'));

test('routes: each document has its current page and its versioned page', () => {
  for (const doc of LEGAL_DOCS) {
    assert.ok(pageAt(legalPath(doc)), `${legalPath(doc)}/page.tsx`);
    assert.ok(pageAt(`${legalPath(doc)}/[version]`), `${legalPath(doc)}/[version]/page.tsx`);
  }
  assert.ok(pageAt('/legal/terms/changes/[version]'));
  assert.ok(pageAt('/(dashboard)/app/terminos'));
});

test('routes: every footer legal link has a page (no 404)', () => {
  assert.deepEqual(
    LEGAL_PAGES.map((p) => p.href),
    ['/legal/terms', '/legal/subscription', '/legal/privacy', '/legal/acceptable-use'],
  );
  for (const p of LEGAL_PAGES) assert.ok(pageAt(p.href), p.href);
});

test('redirects: the Spanish short paths and versioned aliases reach /legal/*', () => {
  const next = readFileSync(join(ROOT, 'next.config.ts'), 'utf8');
  for (const [alias, slug] of [
    ['terminos', 'terms'],
    ['suscripcion', 'subscription'],
    ['privacidad', 'privacy'],
    ['uso-aceptable', 'acceptable-use'],
  ] as const) {
    assert.match(next, new RegExp(`\\['${alias}', '${slug}'\\]`), alias);
  }
  assert.match(next, /source: '\/terminos\/cambios\/:version'/);
  const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')) as {
    redirects: { source: string; destination: string; permanent: boolean }[];
  };
  for (const [alias, dest] of [
    ['/suscripcion', '/legal/subscription'],
    ['/uso-aceptable', '/legal/acceptable-use'],
  ] as const) {
    const r = vercel.redirects.find((x) => x.source.startsWith(`${alias}/`));
    assert.ok(r && r.destination.startsWith(dest) && r.permanent, alias);
  }
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|json|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

test('never link the stale PDF (chalyb-politicas-borrador.pdf)', () => {
  for (const f of [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'messages'))]) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /politicas-borrador\.pdf/, f);
  }
});

// ── Re-acceptance (aceptacion-ux §8; old P6-5) ────────────────────────────

const meta = (relevance: 'relevant' | 'minor', effective = '2026-11-01') => ({
  published: true,
  effective,
  relevance,
  changes: ['uno'],
});
const none: TermsHistory = { acceptedVersion: null, noticeShown: [] };
const after = new Date('2026-11-02T00:00:00Z');

test('re-accept: relevant change → modal after the effective date only', () => {
  const base = { published: true, current: '1.1', meta: meta('relevant'), now: after };
  assert.equal(
    termsPrompt({ ...base, history: { acceptedVersion: '1.0', noticeShown: [] } }),
    'modal',
  );
  assert.equal(termsPrompt({ ...base, history: none }), 'modal');
  assert.equal(
    termsPrompt({ ...base, now: new Date('2026-10-31T00:00:00Z'), history: none }),
    'none',
    'not before the effective date (the ≥30-day email comes first)',
  );
  assert.equal(
    termsPrompt({ ...base, history: { acceptedVersion: '1.1', noticeShown: [] } }),
    'none',
  );
});

test('re-accept: minor change → banner once; drafts and unpublished → nothing', () => {
  const base = { published: true, current: '1.1', meta: meta('minor'), now: after };
  assert.equal(
    termsPrompt({ ...base, history: { acceptedVersion: '1.0', noticeShown: [] } }),
    'banner',
  );
  assert.equal(
    termsPrompt({ ...base, history: { acceptedVersion: '1.0', noticeShown: ['1.1'] } }),
    'none',
  );
  assert.equal(termsPrompt({ ...base, published: false, history: none }), 'none');
  assert.equal(
    termsPrompt({ ...base, meta: { ...meta('relevant'), published: false }, history: none }),
    'none',
  );
  assert.equal(
    termsPrompt({
      ...base,
      meta: { ...meta('relevant'), effective: null as unknown as string },
      history: none,
    }),
    'none',
  );
});

test('re-accept: history reads accepting events and banner views from the consent log', () => {
  const h = termsHistory([
    { event_type: 'signup_terms_accepted', documents: [{ doc: 'terminos', version: '1.0' }] },
    { event_type: 'trial_started', documents: [{ doc: 'suscripcion', version: '1.4' }] },
    { event_type: 'terms_reaccepted', documents: [{ doc: 'terminos', version: '1.10' }] },
    { event_type: 'terms_notice_shown', documents: [{ doc: 'terminos', version: '1.11' }] },
    { event_type: 'charge_succeeded', documents: [{ doc: 'terminos', version: '9.0' }] },
  ]);
  assert.deepEqual(h, { acceptedVersion: '1.10', noticeShown: ['1.11'] });
  assert.ok(compareVersions('1.10', '1.9') > 0);
});

test('re-accept: the modal never blocks cancelling, its options, downloads or help', () => {
  for (const p of [
    '/app/billing',
    '/en/app/billing',
    '/app/terminos',
    '/app/history',
    '/app/help',
    '/app/messages',
  ]) {
    assert.equal(termsModalExempt(p), true, p);
  }
  for (const p of ['/app', '/app/clips', '/en/app/planes', '/app/billingx'])
    assert.equal(termsModalExempt(p), false, p);
});

test('re-accept: Law’s §8 copy is verbatim in es.json', () => {
  const es = JSON.parse(readFileSync(join(ROOT, 'messages/es.json'), 'utf8')).termsUpdate;
  const law = readFileSync(join(LAW, 'aceptacion-ux.md'), 'utf8');
  for (const s of [
    es.title,
    es.seeAll,
    es.disagree,
    es.accept,
    es.options,
    es.bannerText,
    es.bannerLink,
  ]) {
    assert.ok(law.includes(s), s);
  }
  assert.ok(law.includes('A partir del **{fecha_vigencia}** cambian algunos puntos:'));
  assert.equal(es.lead, 'A partir del <b>{fecha}</b> cambian algunos puntos:');
});

test('publish gate: the e2e override needs mock adapters (never on a real deployment)', () => {
  withEnv(
    {
      E2E_LEGAL_DRAFTS_AS_PUBLISHED: '1',
      LEGAL_PUBLISH: 'true',
      NODE_ENV: 'production',
      E2E_USE_MOCK_ADAPTERS: undefined,
    },
    () => assert.equal(legalPublished(), false),
  );
  withEnv(
    {
      E2E_LEGAL_DRAFTS_AS_PUBLISHED: '1',
      LEGAL_PUBLISH: 'true',
      NODE_ENV: 'production',
      E2E_USE_MOCK_ADAPTERS: '1',
    },
    () => assert.equal(legalPublished(), true),
  );
});
