// `?next=` allowlist — the value that decides where a freshly-authenticated
// browser lands.

import test from 'node:test';
import assert from 'node:assert/strict';
import { safeNextPath } from '@/lib/auth/safe-next';

const FALLBACK = '/account';

test('keeps same-origin paths, query and all', () => {
  assert.equal(safeNextPath('/app/billing', FALLBACK), '/app/billing');
  assert.equal(safeNextPath('/app/billing?plan=pro', FALLBACK), '/app/billing?plan=pro');
  assert.equal(safeNextPath('/en/app/billing', FALLBACK), '/en/app/billing');
});

test('falls back when there is nothing to honour', () => {
  assert.equal(safeNextPath(null, FALLBACK), FALLBACK);
  assert.equal(safeNextPath('', FALLBACK), FALLBACK);
});

test('rejects off-site destinations', () => {
  for (const hostile of [
    'https://evil.com',
    'http://evil.com/app',
    'mailto:someone@evil.com',
    'javascript:alert(1)',
    'evil.com',
    '//evil.com',
    '/\\evil.com', // browsers normalize \ to / — protocol-relative in disguise
    '/\\/evil.com',
    '%2F%2Fevil.com', // survives one decode pass into //evil.com
    '/%5Cevil.com',
  ]) {
    assert.equal(safeNextPath(hostile, FALLBACK), FALLBACK, `should reject ${hostile}`);
  }
});

test('rejects header-splitting and absurd lengths', () => {
  assert.equal(safeNextPath('/app\nLocation: https://evil.com', FALLBACK), FALLBACK);
  assert.equal(safeNextPath('/app\r\nSet-Cookie: a=b', FALLBACK), FALLBACK);
  assert.equal(safeNextPath('/' + 'a'.repeat(600), FALLBACK), FALLBACK);
});

test('rejects malformed percent-encoding instead of throwing', () => {
  assert.equal(safeNextPath('/app/%zz', FALLBACK), FALLBACK);
});
