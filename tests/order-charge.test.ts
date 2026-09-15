// The Orders API and the Payments API report a one-off charge differently;
// the webhook settles both through one shape.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chargeFromOrder,
  chargeFromPayment,
  orderAmount,
  orderStatusToChargeStatus,
  paymentStatusToChargeStatus,
} from '@/lib/payments/order-charge';

test('order statuses map onto the ledger vocabulary', () => {
  assert.equal(orderStatusToChargeStatus('processed'), 'approved');
  assert.equal(orderStatusToChargeStatus('created'), 'pending');
  assert.equal(orderStatusToChargeStatus('action_required'), 'pending');
  assert.equal(orderStatusToChargeStatus('canceled'), 'cancelled');
  assert.equal(orderStatusToChargeStatus('expired'), 'cancelled');
  assert.equal(orderStatusToChargeStatus('failed'), 'rejected');
  assert.equal(orderStatusToChargeStatus('refunded'), 'refunded');
  assert.equal(orderStatusToChargeStatus('something_else'), 'unknown');
  assert.equal(orderStatusToChargeStatus(undefined), 'unknown');
});

test('payment statuses pass through and junk becomes unknown', () => {
  assert.equal(paymentStatusToChargeStatus('approved'), 'approved');
  assert.equal(paymentStatusToChargeStatus('in_process'), 'in_process');
  assert.equal(paymentStatusToChargeStatus('charged_back'), 'charged_back');
  assert.equal(paymentStatusToChargeStatus('weird'), 'unknown');
});

test('a processed order is an approved charge keyed by its payment id', () => {
  const c = chargeFromOrder({
    id: 'ORD01',
    status: 'processed',
    external_reference: 'pack|user-1|tokens_100k',
    total_amount: '149.00',
    total_paid_amount: '149.00',
    currency: 'MXN',
    transactions: { payments: [{ id: '123456', status: 'processed', amount: '149.00' }] },
  });
  assert.deepEqual(c, {
    source: 'order',
    mpPaymentId: '123456',
    mpReference: 'ORD01',
    status: 'approved',
    amountMajor: 149,
    currency: 'MXN',
    externalReference: 'pack|user-1|tokens_100k',
  });
});

test('an order with no payment yet is keyed by the order id and carries the order total', () => {
  const c = chargeFromOrder({
    id: 'ORD02',
    status: 'created',
    external_reference: 'pack|user-1|tokens_500k',
    total_amount: '599.00',
    total_paid_amount: '0.00',
    currency: 'MXN',
  });
  assert.equal(c.mpPaymentId, 'ORD02');
  assert.equal(c.status, 'pending');
  assert.equal(c.amountMajor, 599);
});

test('Orders API amounts are strings with two decimals', () => {
  assert.equal(orderAmount(14900), '149.00');
  assert.equal(orderAmount(199900), '1999.00');
  assert.equal(orderAmount(5), '0.05');
});

test('a Payments API payment normalises the same way', () => {
  const c = chargeFromPayment(
    {
      id: 987,
      status: 'approved',
      external_reference: 'u|PRO',
      transaction_amount: 749,
      currency_id: 'MXN',
    },
    'fallback',
  );
  assert.equal(c.source, 'payment');
  assert.equal(c.mpPaymentId, '987');
  assert.equal(c.amountMajor, 749);
  // No id on the payload → the notification's id keys the ledger.
  assert.equal(chargeFromPayment({ status: 'pending' }, '555').mpPaymentId, '555');
});
