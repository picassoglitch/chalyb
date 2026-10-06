#!/usr/bin/env node
// `pnpm build` runs this first: the deploy-blocking half of `pnpm test:legal`
// (old P6-10 #6, 7a review). With LEGAL_PUBLISH=true the build fails while
// any current legal version is a draft, has a bracket left or disagrees with
// the config, computed fresh from the registry and the archive
// (scripts/legal-state.mjs), never trusted from the committed
// publish-state.json. A stale publish-state.json fails too, since the app
// reads that file at runtime. If the state can't be computed, the build
// fails (closed). With LEGAL_PUBLISH off it only reports, from the file.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const on = (v) => /^(1|true)$/i.test(process.env[v] ?? '');
const committed = JSON.parse(
  readFileSync(new URL('../src/lib/legal/publish-state.json', import.meta.url), 'utf8'),
);

function blockersOf(state) {
  const out = [];
  for (const [doc, s] of Object.entries(state)) {
    if (!s.published) out.push(`${doc}@${s.version}: draft`);
    if (s.placeholders > 0) out.push(`${doc}@${s.version}: ${s.placeholders} bracket(s) left`);
    for (const issue of s.consistency ?? []) out.push(`${doc}@${s.version}: ${issue}`);
  }
  return out;
}

// Same exception as flags.ts legalDraftsAsPublished(): local e2e only.
const e2eOverride =
  on('E2E_LEGAL_DRAFTS_AS_PUBLISHED') &&
  on('E2E_USE_MOCK_ADAPTERS') &&
  process.env.VERCEL_ENV !== 'production';

if (!on('LEGAL_PUBLISH') || e2eOverride) {
  const n = blockersOf(committed).length;
  if (n) console.log(`legal gate: ${n} blocker(s); LEGAL_PUBLISH is off, so not failing.`);
  process.exit(0);
}

const run = spawnSync(
  process.execPath,
  [
    '--experimental-strip-types',
    '--no-warnings',
    '--import',
    './tests/ts-resolve.mjs',
    'scripts/legal-state.mjs',
  ],
  { encoding: 'utf8', cwd: new URL('..', import.meta.url) },
);
let fresh;
try {
  if (run.status !== 0) throw new Error(run.stderr || `exit ${run.status}`);
  fresh = JSON.parse(run.stdout);
} catch (e) {
  console.error(
    '✗ LEGAL_PUBLISH=true but the legal state could not be computed, so the build is refused:',
  );
  console.error(String(e.message ?? e).slice(0, 2000));
  process.exit(1);
}

const blockers = blockersOf(fresh);
if (JSON.stringify(fresh) !== JSON.stringify(committed)) {
  blockers.push('src/lib/legal/publish-state.json is stale: run pnpm legal:hash and commit it');
}
if (blockers.length) {
  console.error('✗ LEGAL_PUBLISH=true but the legal texts are not ready:');
  for (const b of blockers) console.error(`  - ${b}`);
  process.exit(1);
}
console.log('legal gate: ok');
