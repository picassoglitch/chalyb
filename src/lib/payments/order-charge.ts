// One shape for "somebody paid (or tried to)", whatever Mercado Pago API it
// came through. The webhook receives one-off payments two ways: the Payments
// API (`payment` topic, the legacy Checkout Pro preferences) and the Orders
// API (`orders` topic, Checkout Pro via Orders, which is what the token pack
// checkout creates today). Both are reduced to this before anything is
// recorded or granted, so the settlement logic exists once. Pure, no I/O.

/** Status vocabulary the settlement understands. It is the Payments API's,
 *  because that is what `payments.status` and /app/billing already speak. */
export type ChargeStatus =
  | 'approved'
  | 'pending'
  | 'in_process'
  | 'rejected'
  | 'cancelled'
  | 'refunded'
  | 'charged_back'
  | 'unknown';

export interface NormalizedCharge {
  /** Which API the charge came from, for logs and the audit trail. */
  source: 'payment' | 'order';
  /** The id that keys the `payments` ledger (UNIQUE). For an order it is the
   *  id of its payment when Mercado Pago has one, else the order id. */
  mpPaymentId: string;
  /** The id to quote to humans and to Mercado Pago support. */
  mpReference: string;
  status: ChargeStatus;
  /** Major units, as Mercado Pago reports them (749.00). null when unknown. */
  amountMajor: number | null;
  currency: string | null;
  externalReference: string;
}

/** Minimal view of GET /v1/orders/{id}. Only what the settlement reads. */
export interface OrderLike {
  id?: string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  total_amount?: string;
  total_paid_amount?: string;
  currency?: string;
  transactions?: {
    payments?: Array<{ id?: string; status?: string; amount?: string; paid_amount?: string }>;
  };
}

/** Minimal view of GET /v1/payments/{id}. */
export interface PaymentLike {
  id?: number | string;
  status?: string;
  external_reference?: string;
  transaction_amount?: number;
  currency_id?: string;
}

/**
 * Orders API → Payments API status. An order is `processed` once its money
 * is in; `created` and `action_required` are still waiting on the buyer;
 * `expired` and `canceled` will never be paid; `failed` was tried and
 * refused.
 */
export function orderStatusToChargeStatus(status: string | null | undefined): ChargeStatus {
  switch ((status ?? '').trim().toLowerCase()) {
    case 'processed':
      return 'approved';
    case 'created':
    case 'action_required':
    case 'at_terminal':
      return 'pending';
    case 'canceled':
    case 'cancelled':
    case 'expired':
      return 'cancelled';
    case 'failed':
      return 'rejected';
    case 'refunded':
      return 'refunded';
    default:
      return 'unknown';
  }
}

/** Payments API statuses pass through; anything unexpected is `unknown`. */
export function paymentStatusToChargeStatus(status: string | null | undefined): ChargeStatus {
  const s = (status ?? '').trim().toLowerCase();
  switch (s) {
    case 'approved':
    case 'pending':
    case 'in_process':
    case 'rejected':
    case 'cancelled':
    case 'refunded':
    case 'charged_back':
      return s;
    default:
      return 'unknown';
  }
}

function toAmount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function chargeFromOrder(order: OrderLike): NormalizedCharge {
  const orderId = order.id ?? '';
  const payment = order.transactions?.payments?.[0];
  const status = orderStatusToChargeStatus(order.status);
  // What was actually paid, when something was; the order total otherwise,
  // so a pending or failed charge still shows the right figure in the ledger.
  const paid = toAmount(order.total_paid_amount);
  const amountMajor = status === 'approved' && paid ? paid : toAmount(order.total_amount);
  return {
    source: 'order',
    mpPaymentId: payment?.id ? String(payment.id) : orderId,
    mpReference: orderId,
    status,
    amountMajor,
    currency: order.currency ?? null,
    externalReference: order.external_reference ?? '',
  };
}

export function chargeFromPayment(payment: PaymentLike, fallbackId: string): NormalizedCharge {
  const id = String(payment.id ?? fallbackId);
  return {
    source: 'payment',
    mpPaymentId: id,
    mpReference: id,
    status: paymentStatusToChargeStatus(payment.status),
    amountMajor: toAmount(payment.transaction_amount),
    currency: payment.currency_id ?? null,
    externalReference: payment.external_reference ?? '',
  };
}

/** "1000.00" — the Orders API takes amounts as strings with two decimals. */
export function orderAmount(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}
