#!/usr/bin/env node
// pnpm test:legal — the deploy-blocking legal suite (old P6-10 #6, WS-12).
//
// 1. Scans every legal page as it renders for Law's bracket placeholders
//    (`[` + uppercase: [RAZÓN SOCIAL], [IVA: CONFIRMAR], …). By default it
//    renders from the registry; with LEGAL_BASE_URL=https://… it fetches the
//    live pages instead (/legal/terms, /legal/subscription, …).
//    Placeholders fail the run when LEGAL_PUBLISH=true or --strict; otherwise
//    they're listed (drafts are expected to have them).
// 2. Runs the legal unit tests: pages/versions/gate, the §11 release gate,
//    trial, price rules, price change, Pro Lealtad, refunds/chargebacks,
//    guardrails, customer copy and i18n parity.

import { spawnSync } from 'node:child_process';

const strict =
  process.argv.includes('--strict') || /^(1|true)$/i.test(process.env.LEGAL_PUBLISH ?? '');
const {
  LEGAL_DOCS,
  PLACEHOLDER_RE: PLACEHOLDER,
  legalPath,
  placeholders,
} = await import('../src/lib/legal/registry.ts');

async function liveText(path) {
  const res = await fetch(new URL(path, process.env.LEGAL_BASE_URL), { redirect: 'follow' });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  const html = await res.text();
  const main = /<main[\s\S]*?<\/main>/i.exec(html)?.[0] ?? html;
  return main
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

let found = 0;
for (const doc of LEGAL_DOCS) {
  const path = legalPath(doc);
  const hits = process.env.LEGAL_BASE_URL
    ? [...(await liveText(path)).matchAll(PLACEHOLDER)].map((m) => m[0])
    : placeholders(doc);
  found += hits.length;
  const uniq = [...new Set(hits)];
  console.log(`${hits.length ? '✗' : '✓'} ${path}: ${hits.length} placeholder(s)`);
  for (const h of uniq.slice(0, 12))
    console.log(`    ${h.length > 90 ? `${h.slice(0, 87)}…]` : h}`);
  if (uniq.length > 12) console.log(`    … ${uniq.length - 12} more`);
}
if (found && strict) {
  console.error(`\n✗ ${found} placeholder(s) left: legal pages can't be published.`);
  process.exit(1);
}
if (found)
  console.log(
    `\n(${found} placeholders in the drafts; not failing: LEGAL_PUBLISH is off. Use --strict to fail.)\n`,
  );

const SUITE = [
  'legal',
  'legal-p6',
  'legal-notices',
  'legal-takedown',
  'release-gate',
  'trial-7d',
  'price-rules',
  'price-change',
  'pro-lealtad',
  'refunds-chargebacks',
  'guardrails',
  'customer-copy',
  'i18n-parity',
].map((f) => `tests/${f}.test.ts`);
const run = spawnSync(
  process.execPath,
  [
    '--experimental-strip-types',
    '--no-warnings',
    '--import',
    './tests/ts-resolve.mjs',
    '--test',
    ...SUITE,
  ],
  { stdio: 'inherit' },
);
process.exit(run.status ?? 1);
