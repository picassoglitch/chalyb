import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { CATEGORIES, ROSTER, searchRoster } from '@chalito/roster';
import { parseCatalog } from '../src/lib/chalito/web/store';
import { attestationOk, checkPhoto, parseCreation } from '../src/lib/chalito/web/avatar';
import es from '../src/lib/chalito/messages/es.json' with { type: 'json' };
import en from '../src/lib/chalito/messages/en.json' with { type: 'json' };

const PUBLIC = new URL('../public/roster/', import.meta.url);

test('the roster is 220 companions in 11 categories, each with its art served from public/roster', () => {
  assert.equal(ROSTER.length, 220);
  assert.equal(CATEGORIES.length, 11);
  for (const r of ROSTER) {
    for (const p of [r.card, ...Object.values(r.drawings), ...Object.values(r.thumbs)])
      assert.ok(existsSync(new URL(p, PUBLIC)), `public/roster/${p}`);
  }
  assert.ok(searchRoster('chalito').some((r) => r.id === 'chalito'));
});

test('every wearable in public/roster/cosmetics is a webp the store can point at', () => {
  const files = readdirSync(new URL('cosmetics/', PUBLIC));
  assert.ok(files.length >= 28);
  for (const f of files) assert.match(`cosmetics/${f}`, /^cosmetics\/[a-z0-9_]+\.webp$/);
  // The cards carry neck anchors for neck pieces.
  const card = JSON.parse(readFileSync(new URL('assets/chalito/card.json', PUBLIC), 'utf8'));
  assert.ok(card.anchors.neck);
});

const item = {
  id: 'star_cape',
  name: { es: 'Capa de estrellas', en: 'Star cape' },
  slot: 'back',
  free: false,
  priceTokens: 1000,
  art: 'cosmetics/star_cape.webp',
  card: { width: 0.72, pivot: [0.5, 0.12] },
  owned: false,
};

test('the store parser takes neck pieces, capes hung from the neck and skins', () => {
  const bow = { ...item, id: 'bow_tie', slot: 'neck', art: 'cosmetics/bow_tie.webp', card: { neckWidth: 0.8, pivot: [0.5, 0.5] } };
  const cape = { ...item, id: 'hero_cape', card: { width: 0.85, pivot: [0.5, 0.04], anchorY: 'neck' } };
  const skin = { id: 'skin_gold', name: { es: 'Dorado', en: 'Gold' }, slot: 'skin', free: false, priceTokens: 10000, skin: 'gold', owned: false };
  assert.deepEqual(parseCatalog({ items: [item, bow, cape, skin] }), [item, bow, cape, skin]);
  // An effect this build can't draw is skipped, not a broken store.
  assert.deepEqual(parseCatalog({ items: [item, { ...skin, skin: 'lava' }] }), [item]);
  assert.equal(parseCatalog({ items: [{ ...bow, card: { width: 0.3, pivot: [0.5, 0.5] } }] }), null);
  assert.equal(parseCatalog({ items: [{ ...cape, card: { ...cape.card, anchorY: 'feet' } }] }), null);
  assert.equal(parseCatalog({ items: [{ ...item, art: 'https://evil.example/x.webp' }] }), null);
});

test('Crea tu personaje: age gate, photo checks and signed URLs only from the bucket', () => {
  assert.equal(attestationOk({ ownPhoto: true, ageBand: '18_plus', guardianConsent: false }), true);
  assert.equal(attestationOk({ ownPhoto: true, ageBand: '13_17', guardianConsent: false }), false);
  assert.equal(attestationOk({ ownPhoto: true, ageBand: '13_17', guardianConsent: true }), true);
  assert.equal(attestationOk({ ownPhoto: true, ageBand: 'under_13', guardianConsent: true }), false);
  assert.equal(attestationOk({ ownPhoto: false, ageBand: '18_plus', guardianConsent: false }), false);
  assert.equal(checkPhoto({ type: 'image/gif', size: 10 }), 'type');
  assert.equal(checkPhoto({ type: 'image/png', size: 11 * 1024 * 1024 }), 'size');
  assert.equal(checkPhoto({ type: 'image/jpeg', size: 1000 }), 'ok');
  const card = (host: string) => ({
    creationId: 'cr_1',
    status: 'succeeded',
    free: true,
    priceTokens: 0,
    card: {
      manifest: { emotions: { src: { neutral: 'layer-neutral.webp' } }, thumbs: { '128': 'thumb-128.webp' } },
      urls: { 'layer-neutral.webp': `${host}/a`, 'thumb-128.webp': `${host}/b` },
    },
  });
  assert.ok(parseCreation(card('https://storage.googleapis.com/bucket')));
  assert.equal(parseCreation(card('https://evil.example')), null);
});

test('the new Chalito copy exists in Spanish and English', () => {
  for (const m of [es, en] as Record<string, Record<string, unknown>>[]) {
    const store = m.store as Record<string, Record<string, string>>;
    for (const g of ['neck', 'head', 'face', 'back', 'effects']) assert.ok(store.groups![g]);
    for (const k of ['accessories', 'skins']) assert.ok(store.tabs![k]);
    for (const s of ['neck', 'skin']) assert.ok(store.slot![s]);
    const cc = m.createCharacter as Record<string, Record<string, string>>;
    for (const f of ['rejected', 'refused', 'provider', 'upload_missing', 'timeout', 'expired', 'upload'])
      assert.ok(cc.failure![f], f);
    for (const b of ['18_plus', '13_17', 'under_13'])
      assert.ok((cc.consent as unknown as { band: Record<string, string> }).band[b]);
    assert.ok((m.nav as Record<string, string>).character);
    assert.ok(((m.home as Record<string, Record<string, string>>).sections!).character);
    const avatar = (m.settings as Record<string, Record<string, string>>).avatar!;
    for (const k of ['search', 'searchPlaceholder', 'categories', 'all', 'selected', 'empty', 'custom']) assert.ok(avatar[k], k);
  }
});
