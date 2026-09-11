// One-shot port: flat reference locale keys -> nested next-intl messages.
// Merges into existing messages/{en,es}.json, preserving meta + auth from step 02,
// removing the step-01 "home" placeholder, and verifying EN/ES parity at the end.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// 5 flat keys collide with deeper paths in the reference set
// (form.name vs form.name.ph etc). Rename the bare label to .label so it
// can live as a sibling of .ph under the same nested parent.
const LABEL_RENAMES = new Set([
  'form.name',
  'form.company',
  'form.need',
  'form.idea',
  'form.bring',
]);

function flatToNested(flat) {
  const out = {};
  for (const rawKey of Object.keys(flat)) {
    const value = flat[rawKey];
    const key = LABEL_RENAMES.has(rawKey) ? `${rawKey}.label` : rawKey;
    const parts = key.split('.');
    let cur = out;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (cur[p] === undefined || typeof cur[p] !== 'object' || Array.isArray(cur[p])) {
        cur[p] = {};
      }
      cur = cur[p];
    }
    cur[parts[parts.length - 1]] = value;
  }
  return out;
}

function flattenLeaves(obj, prefix = '', acc = []) {
  if (Array.isArray(obj)) {
    acc.push(prefix);
    return acc;
  }
  if (obj !== null && typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      flattenLeaves(obj[k], prefix ? `${prefix}.${k}` : k, acc);
    }
    return acc;
  }
  acc.push(prefix);
  return acc;
}

function loadJson(p) {
  return JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));
}

function saveJson(p, data) {
  writeFileSync(resolve(ROOT, p), JSON.stringify(data, null, 2) + '\n', 'utf8');
}

const refEn = loadJson('.chalyb-reference/reference-en.json');
const refEs = loadJson('.chalyb-reference/reference-es.json');

const portedEn = flatToNested(refEn);
const portedEs = flatToNested(refEs);

const existingEn = loadJson('messages/en.json');
const existingEs = loadJson('messages/es.json');

// Preserve meta + auth; drop the step-01 home placeholder; merge in ported keys.
const mergedEn = {
  meta: existingEn.meta,
  auth: existingEn.auth,
  ...portedEn,
};
const mergedEs = {
  meta: existingEs.meta,
  auth: existingEs.auth,
  ...portedEs,
};

saveJson('messages/en.json', mergedEn);
saveJson('messages/es.json', mergedEs);

const enLeaves = new Set(flattenLeaves(mergedEn).sort());
const esLeaves = new Set(flattenLeaves(mergedEs).sort());

const onlyEn = [...enLeaves].filter((k) => !esLeaves.has(k));
const onlyEs = [...esLeaves].filter((k) => !enLeaves.has(k));

console.log('--- PORT RESULT ---');
console.log(`reference-en.json: ${Object.keys(refEn).length} flat keys`);
console.log(`reference-es.json: ${Object.keys(refEs).length} flat keys`);
console.log(`messages/en.json:  ${enLeaves.size} leaves (incl. meta + auth)`);
console.log(`messages/es.json:  ${esLeaves.size} leaves (incl. meta + auth)`);
console.log(`top-level keys (en): ${Object.keys(mergedEn).sort().join(', ')}`);
console.log(`top-level keys (es): ${Object.keys(mergedEs).sort().join(', ')}`);

if (onlyEn.length === 0 && onlyEs.length === 0) {
  console.log('PARITY: OK (every EN leaf has an ES counterpart and vice versa)');
} else {
  console.log('PARITY: FAILED');
  if (onlyEn.length) console.log('Only in EN:', onlyEn);
  if (onlyEs.length) console.log('Only in ES:', onlyEs);
  process.exit(1);
}
