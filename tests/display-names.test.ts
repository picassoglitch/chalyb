import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENGINE_DISPLAY_NAMES,
  HIDDEN_FROM_CUSTOMERS,
  engineDisplayName,
} from '@/lib/engines/display-names';

test('customer tool names (P0-8)', () => {
  assert.deepEqual(
    [
      'chalybclip',
      'chalybcrypto',
      'chalybobs',
      'chalybbot',
      'chalybpicks',
      'chalybrealtor',
      'chalybtrade',
    ].map((s) => engineDisplayName(s)),
    ['Clips', 'Señales', 'En vivo', 'Asistente', 'Pronósticos', 'Inmuebles', 'Inversiones'],
  );
});

test('no display name carries a Chaly* product name', () => {
  for (const name of Object.values(ENGINE_DISPLAY_NAMES)) assert.doesNotMatch(name, /Chaly/);
});

test('the map wins over a stale database name', () => {
  assert.equal(engineDisplayName('chalybclip', 'ChalyClip'), 'Clips');
  assert.equal(engineDisplayName('newthing', 'Fallback'), 'Fallback');
});

test('chalybstream stays hidden from customers (Q32)', () => {
  assert.ok(HIDDEN_FROM_CUSTOMERS.has('chalybstream'));
});

test('the migration writes the same names as the map', async () => {
  const { readFileSync } = await import('node:fs');
  const sql = readFileSync(
    new URL('../supabase/migrations/0041_tool_display_names.sql', import.meta.url),
    'utf8',
  );
  for (const [slug, name] of Object.entries(ENGINE_DISPLAY_NAMES)) {
    assert.match(sql, new RegExp(`set name = '${name}'\\s+where slug = '${slug}'`), slug);
  }
});
