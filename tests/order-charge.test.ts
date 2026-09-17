// The Orders API and the Payments API report a one-off charge differently;
// the webhook settles both through one shape.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ORDER_IDEMPOTENCY_BUCKET_MS,
  chargeFromOrder,
  chargeFromPayment,
  isAllowedCheckoutUrl,
  isReversal,
  orderAmount,
  orderIdempotencyKey,
  orderStatusToChargeStatus,
  paymentStatusToChargeStatus,
} from '@/lib/payments/order-charge';
import { checkCharge, expectedChargeForPack } from '@/lib/payments/webhook-verify';

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
    paidAmountMajor: 149,
    currency: 'MXN',
    externalReference: 'pack|user-1|tokens_100k',
  });
});

test('the grant is gated on total_amount (the catalog price), never on total_paid_amount', () => {
  // Installment interest or a fee pushed what moved to 650; the pack still
  // cost 599 and that is what the order says was sold.
  const c = chargeFromOrder({
    id: 'ORD03',
    status: 'processed',
    external_reference: 'pack|user-1|tokens_500k',
    total_amount: '599.00',
    total_paid_amount: '650.00',
    currency: 'MXN',
  });
  assert.equal(c.amountMajor, 599);
  assert.equal(c.paidAmountMajor, 650);
  const expected = expectedChargeForPack('tokens_500k')!;
  assert.deepEqual(checkCharge(expected, { amountMajor: c.amountMajor, currency: c.currency }), {
    ok: true,
  });
});

test('an order whose total_amount does not match the catalog is refused, whatever was paid', () => {
  const cheap = chargeFromOrder({
    id: 'ORD04',
    status: 'processed',
    external_reference: 'pack|user-1|tokens_2m',
    total_amount: '149.00', // paid for the small pack…
    total_paid_amount: '1999.00', // …even if MP somehow reports the big figure moved
    currency: 'MXN',
  });
  const expected = expectedChargeForPack('tokens_2m')!;
  const check = checkCharge(expected, { amountMajor: cheap.amountMajor, currency: cheap.currency });
  assert.equal(check.ok, false);
  assert.equal(check.ok === false && check.reason, 'amount');
  // A missing currency is still a refusal.
  const noCurrency = checkCharge(expected, { amountMajor: 1999, currency: null });
  assert.equal(noCurrency.ok === false && noCurrency.reason, 'currency');
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
  assert.equal(c.paidAmountMajor, 0);
});

test('refunds and chargebacks are reversals; nothing else is', () => {
  assert.equal(isReversal('refunded'), true);
  assert.equal(isReversal('charged_back'), true);
  assert.equal(isReversal('approved'), false);
  assert.equal(isReversal('cancelled'), false);
});

test('the order idempotency key is stable for the same purchase window and differs otherwise', () => {
  const now = new Date('2026-09-15T12:03:00Z');
  const base = { userId: 'user-1', packId: 'tokens_500k', mode: 'card' as const };
  const a = orderIdempotencyKey({ ...base, now });
  const retry = orderIdempotencyKey({ ...base, now: new Date(now.getTime() + 30_000) });
  assert.equal(a, retry, 'a retry 30 s later reuses the key');
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, orderIdempotencyKey({ ...base, userId: 'user-2', now }));
  assert.notEqual(a, orderIdempotencyKey({ ...base, packId: 'tokens_100k', now }));
  assert.notEqual(a, orderIdempotencyKey({ ...base, mode: 'hosted', now }));
  assert.notEqual(
    a,
    orderIdempotencyKey({ ...base, now: new Date(now.getTime() + ORDER_IDEMPOTENCY_BUCKET_MS) }),
    'the next window is a new purchase',
  );
});

test('only Mercado Pago hosts may receive the browser', () => {
  assert.equal(
    isAllowedCheckoutUrl('https://www.mercadopago.com.mx/checkout/v1/redirect?order_id=x'),
    true,
  );
  assert.equal(isAllowedCheckoutUrl('https://mercadopago.com/checkout/v1/redirect'), true);
  assert.equal(isAllowedCheckoutUrl('https://www.mercadopago.com/checkout'), true);
  assert.equal(isAllowedCheckoutUrl('http://www.mercadopago.com.mx/checkout'), false);
  assert.equal(isAllowedCheckoutUrl('https://mercadopago.com.mx.evil.com/checkout'), false);
  assert.equal(isAllowedCheckoutUrl('https://evil.com/?u=https://www.mercadopago.com.mx'), false);
  assert.equal(isAllowedCheckoutUrl('javascript:alert(1)'), false);
  assert.equal(isAllowedCheckoutUrl(''), false);
  assert.equal(isAllowedCheckoutUrl(undefined), false);
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
