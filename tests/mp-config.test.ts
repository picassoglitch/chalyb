// The Mercado Pago checkout must refuse to start when the variables it needs
// are not there, and every message has to name the variables as they appear
// in .env.local.example (MERCADOPAGO_*), never the legacy MP_* aliases.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MP_ACCESS_TOKEN_VAR,
  MP_PUBLIC_KEY_VAR,
  MP_WEBHOOK_SECRET_VAR,
  checkoutNotReadyMessage,
  missingCheckoutConfig,
  readAccessToken,
} from '@/lib/payments/mp-config';

test('nothing set → all three checkout variables are reported missing, by canonical name', () => {
  assert.deepEqual(missingCheckoutConfig({}), [
    MP_ACCESS_TOKEN_VAR,
    MP_PUBLIC_KEY_VAR,
    MP_WEBHOOK_SECRET_VAR,
  ]);
});

test('an access token alone is not enough: the card form needs the public key and the webhook its secret', () => {
  assert.deepEqual(missingCheckoutConfig({ MERCADOPAGO_ACCESS_TOKEN: 'tok' }), [
    MP_PUBLIC_KEY_VAR,
    MP_WEBHOOK_SECRET_VAR,
  ]);
});

test('all three canonical variables set → ready', () => {
  assert.deepEqual(
    missingCheckoutConfig({
      MERCADOPAGO_ACCESS_TOKEN: 'tok',
      MERCADOPAGO_PUBLIC_KEY: 'pk',
      MERCADOPAGO_WEBHOOK_SECRET: 's',
    }),
    [],
  );
});

test('the legacy MP_* aliases still count, so an older Vercel setup does not regress', () => {
  assert.deepEqual(
    missingCheckoutConfig({ MP_ACCESS_TOKEN: 'tok', MP_PUBLIC_KEY: 'pk', MP_WEBHOOK_SECRET: 's' }),
    [],
  );
  assert.equal(readAccessToken({ MP_ACCESS_TOKEN: 'TEST-x' }), 'TEST-x');
});

test('the canonical name wins over the alias when both are set', () => {
  assert.equal(
    readAccessToken({ MERCADOPAGO_ACCESS_TOKEN: 'canonical', MP_ACCESS_TOKEN: 'legacy' }),
    'canonical',
  );
});

test('an empty string is treated as unset', () => {
  assert.deepEqual(
    missingCheckoutConfig({
      MERCADOPAGO_ACCESS_TOKEN: '',
      MERCADOPAGO_PUBLIC_KEY: '',
      MERCADOPAGO_WEBHOOK_SECRET: '',
    }),
    [MP_ACCESS_TOKEN_VAR, MP_PUBLIC_KEY_VAR, MP_WEBHOOK_SECRET_VAR],
  );
});

test('the message names the real variables and never the legacy alias', () => {
  const msg = checkoutNotReadyMessage([MP_ACCESS_TOKEN_VAR, MP_WEBHOOK_SECRET_VAR]);
  assert.match(msg, /MERCADOPAGO_ACCESS_TOKEN y MERCADOPAGO_WEBHOOK_SECRET/);
  assert.doesNotMatch(msg, /\bMP_ACCESS_TOKEN\b/);
  assert.match(msg, /Vercel/);
  // Three names read as a list, not "a y b y c".
  const three = checkoutNotReadyMessage([
    MP_ACCESS_TOKEN_VAR,
    MP_PUBLIC_KEY_VAR,
    MP_WEBHOOK_SECRET_VAR,
  ]);
  assert.match(
    three,
    /MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_PUBLIC_KEY y MERCADOPAGO_WEBHOOK_SECRET/,
  );
  assert.equal(checkoutNotReadyMessage([MP_PUBLIC_KEY_VAR]).includes(' y '), false);
});
