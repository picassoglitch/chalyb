// Which gateway this deployment sells through, and whether Stripe's variables are set.
// Pure and env-injected (like mp-config.ts) so it is testable without the SDK.

import type { DeclineReason } from './card-decline';

type Env = Record<string, string | undefined>;

export type PaymentsProvider = 'stripe' | 'mercadopago';

export const PAYMENTS_PROVIDER_VAR = 'PAYMENTS_PROVIDER';
export const STRIPE_SECRET_KEY_VAR = 'STRIPE_SECRET_KEY';
export const STRIPE_PUBLISHABLE_KEY_VAR = 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY';
export const STRIPE_WEBHOOK_SECRET_VAR = 'STRIPE_WEBHOOK_SECRET';

/** Mercado Pago unless the variable says exactly `stripe`: merging the Stripe
 *  code changes nothing until someone opts in. */
export function paymentsProvider(env: Env): PaymentsProvider {
  return env[PAYMENTS_PROVIDER_VAR]?.trim().toLowerCase() === 'stripe' ? 'stripe' : 'mercadopago';
}

export interface StripeCredentials {
  secretKey: string | undefined;
  publishableKey: string | undefined;
  webhookSecret: string | undefined;
}

export function stripeCredentials(env: Env): StripeCredentials {
  return {
    secretKey: env[STRIPE_SECRET_KEY_VAR]?.trim() || undefined,
    publishableKey: env[STRIPE_PUBLISHABLE_KEY_VAR]?.trim() || undefined,
    webhookSecret: env[STRIPE_WEBHOOK_SECRET_VAR]?.trim() || undefined,
  };
}

/** Without the webhook secret every event is refused and nothing is ever granted,
 *  so it is required to start a checkout (same fail-closed rule as Mercado Pago). */
export function missingStripeConfig(env: Env): string[] {
  const c = stripeCredentials(env);
  const missing: string[] = [];
  if (!c.secretKey) missing.push(STRIPE_SECRET_KEY_VAR);
  if (!c.publishableKey) missing.push(STRIPE_PUBLISHABLE_KEY_VAR);
  if (!c.webhookSecret) missing.push(STRIPE_WEBHOOK_SECRET_VAR);
  return missing;
}

const modeOf = (key: string, kind: 'sk' | 'pk' | 'rk'): 'test' | 'live' | null => {
  const m = new RegExp(`^${kind}_(test|live)_[A-Za-z0-9]+$`).exec(key);
  return m ? (m[1] as 'test' | 'live') : null;
};

/** Set-but-wrong keys (swapped slots, test mixed with live, prod on test keys).
 *  Names only, never values. */
export function stripeConfigProblems(env: Env): string[] {
  const { secretKey, publishableKey, webhookSecret } = stripeCredentials(env);
  const problems: string[] = [];
  const skMode = secretKey ? (modeOf(secretKey, 'sk') ?? modeOf(secretKey, 'rk')) : null;
  const pkMode = publishableKey ? modeOf(publishableKey, 'pk') : null;
  if (secretKey && !skMode) {
    problems.push(
      `${STRIPE_SECRET_KEY_VAR} no tiene la forma de una llave secreta (sk_live_… o sk_test_…)`,
    );
  }
  if (publishableKey && !pkMode) {
    problems.push(
      `${STRIPE_PUBLISHABLE_KEY_VAR} no tiene la forma de una llave publicable (pk_live_… o pk_test_…)`,
    );
  }
  if (skMode && pkMode && skMode !== pkMode) {
    problems.push(
      `${STRIPE_SECRET_KEY_VAR} es ${skMode} pero ${STRIPE_PUBLISHABLE_KEY_VAR} es ${pkMode}: las dos deben ser del mismo modo`,
    );
  }
  if (webhookSecret && !webhookSecret.startsWith('whsec_')) {
    problems.push(`${STRIPE_WEBHOOK_SECRET_VAR} no empieza con whsec_`);
  }
  if (env.VERCEL_ENV === 'production' && (skMode === 'test' || pkMode === 'test')) {
    problems.push('Producción con llaves de prueba de Stripe: se necesitan las llaves live');
  }
  return problems;
}

export const STRIPE_WEBHOOK_PATH = '/api/stripe/webhook';

/** The events the Stripe dashboard must send to the webhook. */
export const STRIPE_WEBHOOK_EVENTS = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.payment_action_required',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'charge.refunded',
  'charge.dispute.created',
] as const;

// Stripe ids carry a documented type prefix and Mercado Pago's never do: that is how the
// shared id columns (mp_preapproval_id, mp_payment_id) tell whose id they hold.

export function isStripeSubscriptionId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith('sub_');
}

export function isStripePaymentId(id: string | null | undefined): boolean {
  return typeof id === 'string' && (id.startsWith('pi_') || id.startsWith('in_'));
}

// ── Statuses ───────────────────────────────────────────────────────────────

/** Stripe status → the preapproval vocabulary billing speaks. past_due stays authorized:
 *  Stripe is still retrying (as MP does) and grace comes from the failed invoice. */
export function stripeStatusToPreapproval(
  status: string | null | undefined,
  collectionPaused = false,
): 'pending' | 'authorized' | 'paused' | 'cancelled' | 'unknown' {
  switch (status) {
    case 'incomplete':
      return 'pending';
    case 'trialing':
    case 'active':
    case 'past_due':
      return collectionPaused ? 'paused' : 'authorized';
    case 'unpaid':
    case 'paused':
      return 'paused';
    case 'canceled':
    case 'incomplete_expired':
      return 'cancelled';
    default:
      return 'unknown';
  }
}

/** A PaymentIntent status in the ledger vocabulary (order-charge.ts). */
export function paymentIntentToChargeStatus(
  status: string | null | undefined,
): 'approved' | 'pending' | 'in_process' | 'rejected' | 'cancelled' | 'unknown' {
  switch (status) {
    case 'succeeded':
      return 'approved';
    case 'processing':
      return 'in_process';
    case 'requires_action':
    case 'requires_confirmation':
    case 'requires_capture':
      return 'pending';
    case 'requires_payment_method':
      return 'rejected';
    case 'canceled':
      return 'cancelled';
    default:
      return 'unknown';
  }
}

/** Stripe's decline_code (or error code) → the kind of decline the buyer is
 *  told, same words as Mercado Pago's (card-decline.ts). */
export function stripeDeclineReason(code: string | null | undefined): DeclineReason {
  const c = (code ?? '').trim().toLowerCase();
  if (!c) return 'unknown';
  if (
    [
      'fraudulent',
      'stolen_card',
      'lost_card',
      'pickup_card',
      'merchant_blacklist',
      'restricted_card',
      'security_violation',
      'highest_risk_level',
    ].includes(c)
  )
    return 'risk';
  if (c === 'insufficient_funds' || c === 'withdrawal_count_limit_exceeded') return 'funds';
  if (c === 'call_issuer' || c === 'authentication_required' || c === 'approve_with_id')
    return 'authorize';
  if (
    [
      'incorrect_number',
      'invalid_number',
      'incorrect_cvc',
      'invalid_cvc',
      'invalid_expiry_month',
      'invalid_expiry_year',
      'expired_card',
      'incorrect_zip',
      'incorrect_pin',
      'invalid_pin',
    ].includes(c)
  )
    return 'card_data';
  if (
    [
      'card_not_supported',
      'currency_not_supported',
      'transaction_not_allowed',
      'not_permitted',
      'service_not_allowed',
      'invalid_account',
    ].includes(c)
  )
    return 'disabled';
  if (c === 'card_velocity_exceeded' || c === 'pin_try_exceeded') return 'max_attempts';
  if (c === 'duplicate_transaction') return 'duplicated';
  return 'bank';
}

// ── Prices ─────────────────────────────────────────────────────────────────

/** The amount is in the key: Stripe prices are immutable, so a price change gets a new
 *  Price and running subscriptions keep theirs. */
export function stripeLookupKey(
  planKey: string,
  interval: 'month' | 'year',
  cents: number,
): string {
  return `chalyb_${planKey}_${interval}_${cents}_mxn`;
}

/** Our product id per tier (Stripe accepts caller-chosen product ids). */
export function stripeProductId(tier: 'PRO' | 'VIP'): string {
  return tier === 'VIP' ? 'chalyb_vip' : 'chalyb_pro';
}
