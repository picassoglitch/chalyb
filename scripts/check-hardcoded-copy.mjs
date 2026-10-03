#!/usr/bin/env node
// pnpm check:copy — customer-facing TSX must take its words from messages/*.json
// (rebuild prompt §6.1). Fails on JSX text, or a string literal in a `title`,
// `aria-label`, `placeholder` or `alt` prop, that contains letters and is not
// wrapped in t().
//
// Ratchet, not a big bang: the screens this rebuild hasn't reached yet still
// hold hardcoded Spanish. Their current counts live in
// check-hardcoded-copy.baseline.json. A file NOT in the baseline must be clean;
// a baselined file may only go down. When a later phase rebuilds a screen, run
// `pnpm check:copy --update` and the baseline shrinks with it.
//
// Exempt: legal page bodies (they are the legal text itself) and email
// templates (they read the shared copy module).

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const BASELINE = join(ROOT, 'scripts/check-hardcoded-copy.baseline.json');

const DIRS = [
  'src/app/[locale]/(dashboard)/app',
  'src/app/[locale]/(auth)',
  'src/app/[locale]/page.tsx',
  'src/app/[locale]/contacto',
  'src/app/[locale]/planes',
  'src/components/app',
  'src/components/ui',
  'src/components/landing',
  'src/components/public',
  'src/components/workspace',
  'src/components/auth',
];

const PROPS = new Set(['title', 'aria-label', 'placeholder', 'alt']);

/** Not customer-facing: the development-only kitchen sink (404 in production). */
const EXEMPT = [/\/%5Fui\//];

/** Words that are the same in every language: brand, tool and plan names. */
const ALLOWED = new Set([
  'Chalyb',
  'Clips',
  'Señales',
  'En vivo',
  'Asistente',
  'Pronósticos',
  'Inmuebles',
  'Inversiones',
  'Pro',
  'VIP',
  'MXN',
  'YouTube',
  'Twitch',
  'Kick',
  'Facebook',
  'TikTok',
  'Instagram',
]);

function* walk(path) {
  const abs = join(ROOT, path);
  if (statSync(abs).isFile()) {
    if (abs.endsWith('.tsx')) yield abs;
    return;
  }
  for (const name of readdirSync(abs)) yield* walk(join(path, name));
}

function offending(text) {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!/\p{L}{2,}/u.test(trimmed)) return false;
  if (ALLOWED.has(trimmed)) return false;
  return true;
}

function scan(file) {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const hits = [];
  const report = (node, text) => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart());
    hits.push(
      `${relative(ROOT, file)}:${line + 1}  ${text.replace(/\s+/g, ' ').trim().slice(0, 70)}`,
    );
  };
  const visit = (node) => {
    if (ts.isJsxText(node) && offending(node.getText())) report(node, node.getText());
    if (ts.isJsxAttribute(node) && PROPS.has(node.name.getText()) && node.initializer) {
      const init = node.initializer;
      const literal = ts.isStringLiteral(init)
        ? init
        : ts.isJsxExpression(init) &&
            init.expression &&
            (ts.isStringLiteral(init.expression) ||
              ts.isNoSubstitutionTemplateLiteral(init.expression))
          ? init.expression
          : null;
      if (literal && offending(literal.text))
        report(node, `${node.name.getText()}="${literal.text}"`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return hits;
}

const results = {};
for (const dir of DIRS) {
  for (const file of walk(dir)) {
    if (EXEMPT.some((re) => re.test(file))) continue;
    const hits = scan(file);
    if (hits.length) results[relative(ROOT, file)] = hits;
  }
}

if (process.argv.includes('--update')) {
  const counts = Object.fromEntries(
    Object.entries(results)
      .map(([f, h]) => [f, h.length])
      .sort(),
  );
  writeFileSync(BASELINE, `${JSON.stringify(counts, null, 2)}\n`);
  console.log(`baseline updated: ${Object.keys(counts).length} files`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
const failures = [];
for (const [file, hits] of Object.entries(results)) {
  const allowed = baseline[file] ?? 0;
  if (hits.length > allowed) {
    failures.push(`${file}: ${hits.length} hardcoded strings (baseline ${allowed})`);
    if (allowed === 0) for (const h of hits) failures.push(`  ${h}`);
  }
}

if (failures.length) {
  console.error('Hardcoded customer copy — move it to messages/*.json and use t():\n');
  console.error(failures.join('\n'));
  process.exit(1);
}
const shrinkable = Object.keys(baseline).filter((f) => (results[f]?.length ?? 0) < baseline[f]);
if (shrinkable.length)
  console.log(
    `check:copy ok · baseline can shrink for ${shrinkable.length} file(s): run pnpm check:copy --update`,
  );
else console.log('check:copy ok');

// WS-8 · REVISION §S: no copy offers a courtesy refund, says a dispute
// suspends the account (the removed Términos §10.2(a)), or makes writing to
// us first a condition (LFPC art. 90 fr. V). Scans the messages, the emails
// and every source string.
const PHRASES = [
  [/reembolsos? de cortes[ií]a/i, 'courtesy refund (Términos §7.4)'],
  [/cr[eé]ditos de cortes[ií]a/i, 'courtesy credits offered as a refund (Términos §7.4)'],
  [/suspender temporalmente[^.]{0,160}mientras se resuelve/i, 'a dispute suspends the account (old §10.2(a))'],
  [/(antes de (disputar|acudir a tu banco|ir a tu banco)[^.]{0,80}(debes|tienes que|es obligatorio)|(debes|tienes que) escribirnos (primero|antes))/i, 'writing first as a condition (art. 90 fr. V)'],
];
function* walkSource(path) {
  const abs = join(ROOT, path);
  if (statSync(abs).isFile()) {
    if (/\.(tsx?|mjs)$/.test(abs) && !/\.test\./.test(abs)) yield abs;
    return;
  }
  for (const name of readdirSync(abs)) yield* walkSource(join(path, name));
}
const phraseFiles = [
  join(ROOT, 'messages/es.json'),
  join(ROOT, 'messages/en.json'),
  ...walkSource('src'),
];
const phraseHits = [];
for (const file of phraseFiles) {
  const text = readFileSync(file, 'utf8');
  const rules = file.endsWith('en.json')
    ? [...PHRASES, [/courtesy refund/i, 'courtesy refund (Terms §7.4)']]
    : PHRASES;
  for (const [re, why] of rules) if (re.test(text)) phraseHits.push(`${relative(ROOT, file)}: ${why}`);
}
if (phraseHits.length) {
  console.error('Refund/dispute copy that REVISION §S forbids:\n');
  console.error(phraseHits.join('\n'));
  process.exit(1);
}
