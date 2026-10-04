#!/usr/bin/env node
// pnpm build runs this first — the deploy-blocking half of `pnpm test:legal` (old P6-10 #6,
// 7a review): a build with LEGAL_PUBLISH=true fails while any current legal
// version is a draft, has a bracket left, or disagrees with the config. Plain
// Node reading src/lib/legal/publish-state.json (written by legal:hash), so
// it runs on any build machine. With LEGAL_PUBLISH off it only reports.
// The full suite (tests + rendered scan) is `pnpm test:legal`; `pnpm ci`
// runs every gate.

import { readFileSync } from 'node:fs';

const on = (v) => /^(1|true)$/i.test(process.env[v] ?? '');
const state = JSON.parse(
  readFileSync(new URL('../src/lib/legal/publish-state.json', import.meta.url), 'utf8'),
);
const blockers = [];
for (const [doc, s] of Object.entries(state)) {
  if (!s.published) blockers.push(`${doc}@${s.version}: draft`);
  if (s.placeholders > 0) blockers.push(`${doc}@${s.version}: ${s.placeholders} bracket(s) left`);
  for (const issue of s.consistency ?? []) blockers.push(`${doc}@${s.version}: ${issue}`);
}
// Same exception as flags.ts legalDraftsAsPublished(): local e2e only.
const e2eOverride =
  on('E2E_LEGAL_DRAFTS_AS_PUBLISHED') &&
  on('E2E_USE_MOCK_ADAPTERS') &&
  process.env.VERCEL_ENV !== 'production';

if (!on('LEGAL_PUBLISH') || e2eOverride) {
  if (blockers.length)
    console.log(`legal gate: ${blockers.length} blocker(s); LEGAL_PUBLISH is off, so not failing.`);
  process.exit(0);
}
if (blockers.length) {
  console.error('✗ LEGAL_PUBLISH=true but the legal texts are not ready:');
  for (const b of blockers) console.error(`  - ${b}`);
  process.exit(1);
}
console.log('legal gate: ok');
