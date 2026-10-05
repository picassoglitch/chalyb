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
import { stripInternalNotes } from '@/lib/legal/internal-notes';
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
import { subscriptionConsistency } from '@/lib/legal/consistency';
import {
  REACCEPT_DOCS,
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
  sellerValueOk,
} from '@/lib/config/flags';
import publishState from '@/lib/legal/publish-state.json' with { type: 'json' };
import registryJson from '@/lib/legal/registry.json' with { type: 'json' };
import hashes from '@/lib/legal/document-hashes.json' with { type: 'json' };

const ROOT = new URL('../', import.meta.url).pathname;
const LAW = join(ROOT, 'docs/design/app-reimagine/legal');
const lawSource = (doc: string) =>
  readFileSync(join(LAW, (registryJson as Record<string, { file: string }>)[doc]!.file), 'utf8');
/** What renders: Law's file without its "Notas internas (no publicar)". */
const lawPublished = (doc: string) => stripInternalNotes(lawSource(doc));
/** Law's notes to the owner ([…], not a link's text) may quote amounts. */
const withoutOwnerNotes = (s: string) => s.replace(/\[[^[\]]*\](?!\()/g, '');
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
    assert.equal(a.sha256, sha(bindAmounts(lawPublished(doc))), doc);
    assert.equal((hashes as Record<string, string>)[doc], a.sha256, `${doc} document-hashes.json`);
  }
});

test('archive: every version listed in the registry has its module', () => {
  for (const doc of LEGAL_DOCS) {
    assert.ok(listVersions(doc).includes(currentVersion(doc)), doc);
    for (const v of listVersions(doc)) {
      const a = archived(doc, v)!;
      assert.equal(a.sha256, sha(a.rendered), `${doc}@${v} archive is self-consistent`);
      assert.equal(
        a.template.replace(/\{\{[^}]+\}\}/g, ''),
        stripInternalNotes(a.source)
          .replace(/\{\{[^}]+\}\}/g, '')
          .replace(AMOUNT_RE, (m, _us, at: number, all: string) =>
            /\[[^[\]]*$/.test(all.slice(0, at)) ? m : '',
          ),
        `${doc}@${v} template is Law's text without its notes`,
      );
    }
  }
});

test('versioned URL: fixed /legal/<slug>/v<x-y>, stable for a version', () => {
  delete process.env.NEXT_PUBLIC_CANONICAL_ORIGIN;
  const d = legalDocument('suscripcion');
  assert.equal(
    d.url,
    `https://www.chalyb.com/legal/subscription/${versionSlug(currentVersion('suscripcion'))}`,
  );
  // Not in force yet: cited as a draft, so anything accepted against it is
  // asked again after publish (7a review).
  assert.equal(d.version, `${currentVersion('suscripcion')}-draft`);
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
      lawPublished(doc),
      amountRoles(doc),
      false,
    );
    assert.deepEqual([unknown, ambiguous, invalid], [[], [], []], doc);
    assert.equal(
      [...withoutOwnerNotes(template).matchAll(AMOUNT_RE)].length,
      0,
      `${doc} template has no literal amount`,
    );
    assert.equal(template, archived(doc)!.template, `${doc} archived template current`);
  }
});

test('internal notes: archived and hashed without "Notas internas", source kept as written', () => {
  const law = '# Doc\n\nTexto.\n\n---\n\n## Notas internas (no publicar esta sección)\n\nNo va.\n\n### Sub\n\nTampoco.\n';
  assert.equal(stripInternalNotes(law), '# Doc\n\nTexto.\n');
  assert.equal(
    stripInternalNotes('# A\n\n## Notas internas\n\nx\n\n## Sigue\n\ny\n'),
    '# A\n## Sigue\n\ny\n',
  );
  for (const doc of ['paquetes', 'quien_vende'] as const) {
    assert.match(archived(doc)!.source, /Notas internas/, `${doc} source is Law's file`);
    assert.doesNotMatch(archived(doc)!.rendered, /Notas internas|chalyb-src/, `${doc} renders without`);
  }
});

test('amounts: an unexplained amount passes only inside an owner note', () => {
  const ok = tokenizeAmounts('Total $1,999,999.00 [NOTA: antes de IVA $149]', {}, false);
  assert.deepEqual(ok.unknown, ['$1,999,999.00']);
  assert.throws(() => tokenizeAmounts('Paga $149.'), /not in pricing/);
  assert.equal(tokenizeAmounts('[NOTA: si no, $149]').template, '[NOTA: si no, $149]');
  // A link's text is not a note.
  assert.throws(() => tokenizeAmounts('[Paga $149](/paquetes)'), /not in pricing/);
  // Pack totals bind to pricing.ts.
  assert.equal(tokenizeAmounts('Chico $172.84').template, 'Chico {{mxn:pack_100k}}');
});

test('amounts: the packs page shows the pack prices in force, never typed ones', () => {
  // Law's text names the roles; a role that doesn't exist is refused.
  assert.throws(() => tokenizeAmounts('{{mxn:pack_1m}}'), /no such role/);
  const packs = { tokens_100k: 14_900, tokens_500k: 59_900, tokens_2m: 199_900 };
  const live = renderedSource('paquetes', undefined, packs)!;
  assert.match(live, /\| Chico \| 100,000 \| \$149 MXN \| \$1\.49 \|/);
  assert.match(live, /\| Mediano \| 500,000 \| \$599 MXN \| \$1\.20 \|/);
  assert.doesNotMatch(live, /\{\{|\[PRECIO/);
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
    // Law's text binds the roles it names ({{mxn:pack_100k}}) to config.
    assert.equal(renderedSource(doc), bindAmounts(lawPublished(doc)), doc);
    assert.equal(
      archived(doc)!.rendered,
      bindAmounts(lawPublished(doc)),
      `${doc} archived render current`,
    );
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
    assert.equal(frozen.rendered, bindAmounts(lawPublished('suscripcion')));
    assert.notEqual(
      bindAmounts(a.template),
      frozen.rendered,
      'the archive step would refuse: new version needed',
    );
  });
  const reg = readFileSync(join(ROOT, 'src/lib/legal/registry.ts'), 'utf8');
  assert.match(
    reg,
    /versionMeta\(doc, version\)\?\.published \? a\.rendered : bindAmounts\(a\.template, packs\)/,
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

test('placeholders: the owner filled every bracket (2026-10-05)', () => {
  for (const doc of LEGAL_DOCS) assert.deepEqual(placeholders(doc), [], `${doc} still has brackets`);
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
    [
      '/legal/terms',
      '/legal/subscription',
      '/legal/packs',
      '/legal/privacy',
      '/legal/acceptable-use',
    ],
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
    // A clip job's page is where its clips download (7a review).
    '/app/clips/mock_abc_1',
    '/en/app/clips/mock_abc_1',
    // WS-11's routes: a job, one clip, the list of my clips.
    '/app/clips/trabajo/mock_abc_1',
    '/app/clips/3f2a9c1e-77aa-4d1b-9e0c-1b2c3d4e5f60',
    '/app/clips/mis-clips',
  ]) {
    assert.equal(termsModalExempt(p), true, p);
  }
  for (const p of [
    '/app',
    '/app/clips',
    '/app/clips/formato',
    // Settings (connect accounts, auto-publish) and the new-clip steps stay
    // covered (7a merge-watch with WS-11).
    '/app/clips/ajustes',
    '/en/app/clips/ajustes',
    '/app/clips/nuevo',
    '/app/clips/nuevo/formato',
    '/app/clips/trabajo',
    '/app/clips/mock_abc_1/editar',
    '/en/app/planes',
    '/app/billingx',
  ]) {
    assert.equal(termsModalExempt(p), false, p);
  }
});

test('re-accept: Suscripción and Privacidad are re-accepted too, each on its own history', () => {
  assert.deepEqual([...REACCEPT_DOCS], ['terminos', 'suscripcion', 'privacidad']);
  const rows = [
    {
      event_type: 'trial_started',
      documents: [
        { doc: 'terminos', version: '1.0' },
        { doc: 'suscripcion', version: '1.0' },
      ],
    },
    { event_type: 'terms_reaccepted', documents: [{ doc: 'privacidad', version: '1.2' }] },
  ];
  assert.equal(termsHistory(rows, 'suscripcion').acceptedVersion, '1.0');
  assert.equal(termsHistory(rows, 'privacidad').acceptedVersion, '1.2');
  assert.equal(termsHistory(rows).acceptedVersion, '1.0');
});

test('re-accept: no new charge is agreed while a relevant change is unaccepted (§8)', () => {
  for (const f of ['src/app/api/billing/trial/route.ts', 'src/app/api/billing/change/route.ts']) {
    assert.match(
      readFileSync(join(ROOT, f), 'utf8'),
      /termsAcceptancePending\(session\.user\.id\)[\s\S]{0,120}TERMS_PENDING/,
      f,
    );
  }
  assert.match(
    readFileSync(join(ROOT, 'src/lib/payments/subscription-actions.ts'), 'utf8'),
    /termsAcceptancePending\(session\.user\.id\)[\s\S]{0,120}terms_pending/,
  );
});

test('re-accept: Law’s §8 copy is verbatim in es.json', () => {
  const es = JSON.parse(readFileSync(join(ROOT, 'messages/es.json'), 'utf8')).termsUpdate;
  const law = readFileSync(join(LAW, 'aceptacion-ux.md'), 'utf8');
  for (const s of [
    es.titles.terminos,
    es.seeAll,
    es.disagree,
    es.accept,
    es.options,
    es.banner.terminos,
    es.bannerLink,
  ]) {
    assert.ok(law.includes(s), s);
  }
  assert.ok(law.includes('A partir del **{fecha_vigencia}** cambian algunos puntos:'));
  assert.equal(es.lead, 'A partir del <b>{fecha}</b> cambian algunos puntos:');
});

test('publish gate: the e2e override needs mock adapters and a non-production Vercel env', () => {
  const base = {
    E2E_LEGAL_DRAFTS_AS_PUBLISHED: '1',
    LEGAL_PUBLISH: 'true',
    NODE_ENV: 'production',
  };
  withEnv({ ...base, E2E_USE_MOCK_ADAPTERS: undefined, VERCEL_ENV: undefined }, () =>
    assert.equal(legalPublished(), false),
  );
  withEnv({ ...base, E2E_USE_MOCK_ADAPTERS: '1', VERCEL_ENV: 'production' }, () =>
    assert.equal(legalPublished(), false, 'never on Vercel production'),
  );
  withEnv({ ...base, E2E_USE_MOCK_ADAPTERS: '1', VERCEL_ENV: 'preview' }, () =>
    assert.equal(legalPublished(), true),
  );
});

test('drafts never render publicly: a version not in force is the review stub', () => {
  const page = readFileSync(join(ROOT, 'src/components/legal/legal-doc-page.tsx'), 'utf8');
  assert.match(page, /if \(!inForce\(doc, version\)\) \{[\s\S]{0,200}<LegalPage/);
});

test('consistency: Suscripción must match the trial plans and grace in config before publish', () => {
  // §2.1 offers the trial on every plan in config, nothing excludes one, and
  // §8.2 bis says the grace period doesn't apply to the charge that ends it.
  assert.deepEqual(subscriptionConsistency(lawSource('suscripcion')), []);
  assert.ok(!legalPublishBlockers().some((b) => /trial|grace/.test(b)));
  const cfg = {
    trialPlans: ['pro_month', 'pro_year'] as const,
    graceDays: 7,
    firstChargeGraceDays: 0,
  };
  const G = 'El periodo de gracia no aplica al cobro con el que termina la Prueba.';
  const doc = (offer: string, s8: string, extra = '') =>
    `## 2. Prueba\n\n2.1. La Prueba está disponible para ${offer}.\n\n${extra}\n\n## 8. Pagos\n\n8.2. tendrás **7 días naturales**. ${s8}\n`;
  const ok = doc('**Pro mensual** y **Pro anual**', G);
  assert.deepEqual(subscriptionConsistency(ok, cfg), []);
  assert.deepEqual(subscriptionConsistency(ok.replace('**7 días', '**5 días'), cfg), [
    'grace-days:5!=7',
  ]);
  // §8 must say it explicitly: the Prueba merely appearing isn't enough.
  assert.deepEqual(
    subscriptionConsistency(doc('Pro mensual y Pro anual', 'Durante la Prueba no hay cobro.'), cfg),
    ['trial-grace'],
  );
  assert.deepEqual(
    subscriptionConsistency(
      doc(
        'Pro mensual y Pro anual',
        'Al cobro que termina la Prueba no se aplica el periodo de gracia.',
      ),
      cfg,
    ),
    [],
  );
  const all = { ...cfg, trialPlans: ['pro_month', 'pro_year', 'vip_month', 'vip_year'] as const };
  // Naming VIP only to exclude it still blocks.
  assert.deepEqual(
    subscriptionConsistency(doc('Pro mensual y Pro anual (no para VIP ni VIP anual)', G), all),
    ['trial-plans:vip_month,vip_year'],
  );
  assert.deepEqual(
    subscriptionConsistency(doc('Pro mensual, Pro anual, VIP y VIP anual', G), all),
    [],
  );
  // A "no incluye Prueba" anywhere next to a trial plan blocks.
  assert.deepEqual(
    subscriptionConsistency(
      doc(
        'Pro mensual, Pro anual, VIP y VIP anual',
        G,
        '4.2. **VIP anual** no incluye Prueba gratis.',
      ),
      all,
    ),
    ['trial-excluded:vip_year'],
  );
  // Never rewrites Law's text: the check only reads.
  assert.match(
    readFileSync(join(ROOT, 'src/lib/legal/consistency.ts'), 'utf8'),
    /never rewrite Law's text/,
  );
});

test('build gate: recomputes the legal state, fails closed, refuses a stale publish-state.json', () => {
  const gate = readFileSync(join(ROOT, 'scripts/legal-publish-gate.mjs'), 'utf8');
  assert.match(gate, /scripts\/legal-state\.mjs/);
  assert.match(gate, /could not be computed, so the build is refused/);
  assert.match(gate, /publish-state\.json is stale/);
  assert.match(
    readFileSync(join(ROOT, 'package.json'), 'utf8'),
    /"build": "node scripts\/legal-publish-gate\.mjs && next build"/,
  );
});

test('re-accept: plan changes and Pro Lealtad count as accepting the documents they cite', () => {
  const h = termsHistory(
    [
      { event_type: 'plan_changed', documents: [{ doc: 'suscripcion', version: '1.1' }] },
      { event_type: 'lealtad_started', documents: [{ doc: 'privacidad', version: '1.2' }] },
    ],
    'suscripcion',
  );
  assert.equal(h.acceptedVersion, '1.1');
  assert.equal(
    termsHistory(
      [{ event_type: 'lealtad_started', documents: [{ doc: 'privacidad', version: '1.2' }] }],
      'privacidad',
    ).acceptedVersion,
    '1.2',
  );
});

test('re-accept: token packs refuse a new charge while a relevant change is unaccepted (§8)', () => {
  const src = readFileSync(join(ROOT, 'src/lib/payments/token-checkout-actions.ts'), 'utf8');
  const guards =
    src.match(
      /if \(await termsAcceptancePending\(session\.user\.id\)\) \{\s*return \{ ok: false, reason: 'terms_pending'/g,
    ) ?? [];
  assert.equal(guards.length, 2, 'hosted and card');
});

test('seller identity: placeholders, TBD and generic or malformed RFCs are refused', () => {
  for (const [name, v] of [
    ['LEGAL_ENTITY_NAME', '[RAZÓN SOCIAL]'],
    ['LEGAL_ENTITY_ADDRESS', 'TBD'],
    ['LEGAL_ENTITY_PHONE', 'TODO: phone'],
    ['LEGAL_ENTITY_RFC', 'XAXX010101000'],
    ['LEGAL_ENTITY_RFC', 'XEXX010101000'],
    ['LEGAL_ENTITY_RFC', 'ABC123'],
    ['LEGAL_ENTITY_EMAIL', 'hola'],
    ['LEGAL_ENTITY_HOURS', '   '],
  ] as const) {
    assert.equal(sellerValueOk(name, v), false, `${name}=${v}`);
  }
  assert.equal(sellerValueOk('LEGAL_ENTITY_RFC', 'CHA261003AB1'), true, 'company RFC');
  assert.equal(sellerValueOk('LEGAL_ENTITY_RFC', 'GODE561231GR8'), true, 'person RFC');
  assert.equal(sellerValueOk('LEGAL_ENTITY_NAME', 'Chalyb Tecnología S.A. de C.V.'), true);
  assert.equal(sellerValueOk('LEGAL_ENTITY_EMAIL', 'hola@chalyb.com'), true);
});
