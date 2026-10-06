// Public pages send the browser only PUBLIC_CLIENT_NAMESPACES (the app and
// the panel get everything). Every client component a public route renders
// must read only those, or its text is missing on that page.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_CLIENT_NAMESPACES } from '@/i18n/client-messages';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
// Components that public routes render (the in-app ones live under app/ or
// tools/ and only render inside (dashboard)).
const PUBLIC_DIRS = [
  'src/components/legal',
  'src/components/public',
  'src/components/landing',
  'src/components/contact',
  'src/components/auth',
];
// In-app only, though they sit in a shared folder.
const APP_ONLY = new Set(['src/components/legal/terms-update.tsx']);

function* walk(dir: string): Generator<string> {
  for (const n of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, n);
    if (statSync(join(ROOT, rel)).isDirectory()) yield* walk(rel);
    else if (rel.endsWith('.tsx')) yield rel;
  }
}

test('every public client component reads only namespaces sent to the browser', () => {
  const allowed = new Set<string>(PUBLIC_CLIENT_NAMESPACES);
  const misses: string[] = [];
  for (const dir of PUBLIC_DIRS)
    for (const f of walk(dir)) {
      if (APP_ONLY.has(f)) continue;
      const src = readFileSync(join(ROOT, f), 'utf8');
      if (!src.includes("'use client'")) continue;
      for (const m of src.matchAll(/useTranslations\('([a-zA-Z]+)/g))
        if (!allowed.has(m[1]!)) misses.push(`${f}: ${m[1]}`);
    }
  assert.deepEqual(misses, []);
});
