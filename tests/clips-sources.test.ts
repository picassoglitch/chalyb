// One "Hacer clips" page: every source (link, upload, live, channel) lives on
// /app/clips/nuevo?fuente=…; the old one-source pages only redirect there.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  CLIP_SOURCES,
  clipSourceHref,
  legacyClipSourceHref,
  parseClipSource,
} from '@/lib/tools/clips-sources';

test('?fuente= picks a source; anything else is the link', () => {
  for (const s of CLIP_SOURCES) assert.equal(parseClipSource(s), s);
  assert.equal(parseClipSource(undefined), 'enlace');
  assert.equal(parseClipSource(''), 'enlace');
  assert.equal(parseClipSource('subir'), 'enlace');
  assert.equal(parseClipSource('ARCHIVO'), 'enlace');
  assert.equal(parseClipSource(['canal', 'archivo']), 'canal');
});

test('each source has its link on the one page; the link source needs no param', () => {
  assert.equal(clipSourceHref('enlace'), '/app/clips/nuevo');
  assert.equal(clipSourceHref('archivo'), '/app/clips/nuevo?fuente=archivo');
  assert.equal(clipSourceHref('transmision'), '/app/clips/nuevo?fuente=transmision');
  assert.equal(clipSourceHref('canal'), '/app/clips/nuevo?fuente=canal');
});

test('old pages redirect with their query kept (errors included), fuente fixed', () => {
  assert.equal(legacyClipSourceHref('archivo', {}), '/app/clips/nuevo?fuente=archivo');
  assert.equal(
    legacyClipSourceHref('canal', { error: 'no_persona', link: 'https://x.y/?a=1&b=2' }),
    '/app/clips/nuevo?fuente=canal&error=no_persona&link=https%3A%2F%2Fx.y%2F%3Fa%3D1%26b%3D2',
  );
  assert.equal(
    legacyClipSourceHref('transmision', { fuente: 'archivo', tag: ['a', 'b'], gone: undefined }),
    '/app/clips/nuevo?fuente=transmision&tag=a&tag=b',
  );
});

const CLIPS_APP = 'src/app/[locale]/(dashboard)/app/clips';

test('the old one-source pages are redirects to their source', () => {
  for (const [dir, source] of [
    ['subir', 'archivo'],
    ['en-vivo', 'transmision'],
    ['canales', 'canal'],
  ] as const) {
    const src = readFileSync(join(CLIPS_APP, dir, 'page.tsx'), 'utf8');
    assert.match(src, new RegExp(`legacyClipSourceHref\\('${source}'`), dir);
    assert.doesNotMatch(src, /ToolShell|engineRead/, `${dir} renders nothing of its own`);
  }
});

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|mjs)$/.test(p) ? [p] : [];
  });
}

test('nothing links to the old one-source pages any more', () => {
  const redirects = ['subir', 'en-vivo', 'canales'].map((d) => join(CLIPS_APP, d, 'page.tsx'));
  const offenders = files('src')
    .filter((f) => !redirects.includes(f))
    .filter((f) => /['"`]\/app\/clips\/(subir|en-vivo|canales)\b/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(offenders, []);
});
