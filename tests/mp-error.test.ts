// What the Mercado Pago SDK throws is the parsed JSON error body, and each
// API shapes it differently. These are the shapes seen in production.

import test from 'node:test';
import assert from 'node:assert/strict';
import { describeMpError, mpErrorForLog } from '@/lib/payments/mp-error';

test('the Orders API puts the text in errors[].message', () => {
  // POST /v1/orders, the token pack card charge.
  const body = {
    errors: [
      {
        code: 'invalid_request',
        message: 'transactions.payments[0].payment_method.type is invalid',
      },
    ],
  };
  const out = describeMpError(body);
  assert.match(out, /transactions\.payments\[0\]\.payment_method\.type is invalid/);
  assert.match(out, /invalid_request/);
});

test('an Orders error with nested details reports the innermost reason', () => {
  const body = {
    status: 400,
    errors: [
      {
        code: 'validation_error',
        message: 'Invalid order',
        details: [{ code: 'amount_too_low', description: 'total_amount is below the minimum' }],
      },
    ],
  };
  const out = describeMpError(body);
  assert.match(out, /HTTP 400/);
  assert.match(out, /Invalid order/);
  assert.match(out, /total_amount is below the minimum/);
});

test('preapproval reports through message plus a cause array', () => {
  // POST /preapproval, the monthly plan. This is the shape that already
  // worked, and it must keep working.
  const body = {
    message: 'Credit card validation has failed',
    error: 'bad_request',
    status: 400,
    cause: [{ code: 'CC_VAL_433', description: 'Credit card validation has failed' }],
  };
  const out = describeMpError(body);
  assert.match(out, /Credit card validation has failed/);
  assert.match(out, /CC_VAL_433/);
});

test('a bare gateway body still yields its message', () => {
  assert.match(describeMpError({ message: 'invalid access token', status: 401 }), /HTTP 401/);
  assert.match(describeMpError({ message: 'invalid access token', status: 401 }), /invalid access/);
});

test('an empty body is named as a rejected credential, not as nothing', () => {
  const fetchError = { type: 'invalid-json', message: 'invalid json response body' };
  assert.match(describeMpError(fetchError), /sin cuerpo/);
  assert.match(describeMpError(fetchError), /MERCADOPAGO_ACCESS_TOKEN/);
});

test('a real Error and a plain string both come through', () => {
  assert.equal(describeMpError(new Error('socket hang up')), 'socket hang up');
  assert.equal(describeMpError('timeout'), 'timeout');
});

test('nothing readable says so instead of pretending', () => {
  assert.match(describeMpError({}), /sin detalle/);
  assert.match(describeMpError({ status: 500 }), /HTTP 500/);
  assert.match(describeMpError(null), /sin detalle/);
});

test('a message is never repeated just because two keys carry it', () => {
  const body = {
    message: 'Collector and payer cannot be the same',
    cause: [{ code: 3001, description: 'Collector and payer cannot be the same' }],
  };
  const out = describeMpError(body);
  assert.equal(out.match(/Collector and payer cannot be the same/g)?.length, 1);
  assert.match(out, /3001/);
});

test('the log form keeps the whole body', () => {
  const body = { errors: [{ code: 'x', message: 'y' }] };
  const logged = mpErrorForLog(body);
  assert.match(logged, /"code": "x"/);
  assert.match(logged, /"message": "y"/);
  assert.match(mpErrorForLog(new Error('boom')), /Error: boom/);
});
