// What a token-pack order tells Mercado Pago about the buyer and the item
// (scored by "Calidad de integración").

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PACK_CATEGORY_ID,
  STATEMENT_DESCRIPTOR,
  orderAdditionalInfo,
  packItem,
  payerName,
} from '@/lib/payments/order-quality';
import { getTokenPack } from '@/lib/payments/pricing';

test('payer name splits the signup name into first and last', () => {
  assert.deepEqual(payerName({ user_metadata: { full_name: 'María Clara López Roldán' } }), {
    first_name: 'María',
    last_name: 'Clara López Roldán',
  });
  assert.deepEqual(payerName({ user_metadata: { name: '  Pablo  ' } }), { first_name: 'Pablo' });
  assert.deepEqual(payerName({ user_metadata: {} }), {});
  assert.deepEqual(payerName({}), {});
});

test('additional_info uses the flat keys and values the Orders API accepts', () => {
  assert.deepEqual(orderAdditionalInfo({ created_at: '2026-09-01T16:00:00Z' }), {
    'payer.authentication_type': 'WEB',
    'payer.registration_date': '2026-09-01T16:00:00Z',
  });
  assert.deepEqual(orderAdditionalInfo({}), { 'payer.authentication_type': 'WEB' });
});

test('a pack item carries title, description, category, quantity and price', () => {
  const pack = getTokenPack('tokens_100k')!;
  const item = packItem(pack, '172.84');
  assert.equal(item.title, 'Chalyb · +100k tokens');
  assert.match(item.description, /tokens de uso/);
  assert.equal(item.category_id, PACK_CATEGORY_ID);
  assert.equal(item.quantity, 1);
  assert.equal(item.unit_price, '172.84');
  assert.equal(item.external_code, 'pack-tokens_100k');
  assert.equal('unit_measure' in item, false);
});

test('the statement descriptor fits Mercado Pago’s limit', () => {
  assert.ok(STATEMENT_DESCRIPTOR.length <= 10);
});
