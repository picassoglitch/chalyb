import test from 'node:test';
import assert from 'node:assert/strict';
import { intlLocale, tokenFormat } from '../src/lib/chalito/format';

test('token amounts group the same way at every size, with the hub locale (es → es-MX)', () => {
  assert.equal(intlLocale('es'), 'es-MX');
  assert.equal(intlLocale('en'), 'en-US');
  const es = tokenFormat('es');
  // Plain "es" printed "1000" next to "10.000" on the same screen.
  assert.equal(es.format(1000), '1,000');
  assert.equal(es.format(10000), '10,000');
  assert.equal(es.format(217750), '217,750');
  assert.equal(tokenFormat('en').format(1500), '1,500');
});
