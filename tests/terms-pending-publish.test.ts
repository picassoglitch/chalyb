// aceptacion-ux §8 × WS-11: while a relevant Terms change is unaccepted, no
// new publishing or social connecting (403 FORBIDDEN, never an outage);
// downloads stay allowed (the modal exempts /app/clips/<id>).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TermsPendingError } from '@/lib/tools/clips-bff';
import { countsAsOutage, normalizeToolError, statusForReason } from '@/lib/tools/bff-core';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const src = (p: string) => readFileSync(join(ROOT, p), 'utf8');

test('publish and connect refuse while terms are pending; it is 403 and not an outage', () => {
  for (const f of [
    'src/app/api/tools/chalybclip/clips/[clipId]/publish/route.ts',
    'src/app/api/tools/chalybclip/connect/route.ts',
  ])
    assert.match(src(f), /if \(await termsAcceptancePending\(session\.user\.id\)\) throw new TermsPendingError/, f);
  const r = normalizeToolError(new TermsPendingError('terms_pending'));
  assert.equal(r.reason, 'forbidden');
  assert.equal(statusForReason(r.reason), 403);
  assert.equal(countsAsOutage(r.reason), false);
});

test('the clip page hides publishing while pending, never the download', () => {
  const page = src('src/app/[locale]/(dashboard)/app/clips/[clipId]/page.tsx');
  assert.match(page, /socialsAllowed\(gate\.entitlements\.plan\) && !termsPending/);
  assert.doesNotMatch(src('src/app/api/tools/chalybobs/download/route.ts'), /termsAcceptancePending/);
});
