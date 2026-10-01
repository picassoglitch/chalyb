// Canonical origin is www (P0-12, B12/B13).

import test from 'node:test';
import assert from 'node:assert/strict';
import sitemap from '@/app/sitemap';
import robots from '@/app/robots';
import { canonicalOrigin, publicPageMetadata } from '@/lib/site';

test('canonical origin defaults to https://www.chalyb.com', () => {
  delete process.env.NEXT_PUBLIC_CANONICAL_ORIGIN;
  assert.equal(canonicalOrigin(), 'https://www.chalyb.com');
});

test('every sitemap URL and alternate is on www', () => {
  delete process.env.NEXT_PUBLIC_CANONICAL_ORIGIN;
  for (const entry of sitemap()) {
    assert.ok(entry.url.startsWith('https://www.chalyb.com'), entry.url);
    for (const href of Object.values(entry.alternates?.languages ?? {})) {
      assert.ok(String(href).startsWith('https://www.chalyb.com'), String(href));
    }
  }
});

test('sitemap hreflang uses es-MX, en and x-default', () => {
  const home = sitemap().find((e) => e.url === 'https://www.chalyb.com/')!;
  assert.deepEqual(home.alternates?.languages, {
    en: 'https://www.chalyb.com/en',
    'es-MX': 'https://www.chalyb.com/',
    'x-default': 'https://www.chalyb.com/',
  });
});

test('robots points at the www sitemap and keeps private routes out', () => {
  delete process.env.NEXT_PUBLIC_CANONICAL_ORIGIN;
  const r = robots();
  assert.equal(r.sitemap, 'https://www.chalyb.com/sitemap.xml');
  const rules = Array.isArray(r.rules) ? r.rules[0]! : r.rules;
  for (const path of ['/app', '/dashboard', '/en/app'])
    assert.ok([rules.disallow].flat().includes(path));
});

test('a public page gets canonical + hreflang on www', () => {
  const m = publicPageMetadata('/contacto', 'en', { title: 'Contact', description: 'd' });
  assert.equal(m.alternates?.canonical, 'https://www.chalyb.com/en/contacto');
  assert.equal(
    (m.alternates?.languages as Record<string, string>)['es-MX'],
    'https://www.chalyb.com/contacto',
  );
});

test('previews can override the origin', () => {
  process.env.NEXT_PUBLIC_CANONICAL_ORIGIN = 'https://preview.example/';
  assert.equal(canonicalOrigin(), 'https://preview.example');
  delete process.env.NEXT_PUBLIC_CANONICAL_ORIGIN;
});
