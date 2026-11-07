// Whether the deployment's gateway can take a payment now, and the Stripe card form's props.
// Pages and actions ask here instead of a gateway module, so PAYMENTS_PROVIDER decides once.

import 'server-only';
import {
  checkoutConfigWarnings,
  checkoutNotReadyError,
  isCheckoutReady,
  missingCheckoutVars,
} from './mercadopago';
import {
  isStripeReady,
  missingStripeVars,
  stripePublishableKey,
  stripeWarnings,
  usingStripe,
} from './stripe';

export function checkoutReady(): boolean {
  return usingStripe() ? isStripeReady() : isCheckoutReady();
}

export function checkoutMissingVars(): string[] {
  return usingStripe() ? missingStripeVars() : missingCheckoutVars();
}

export function checkoutWarnings(): string[] {
  return usingStripe() ? stripeWarnings() : checkoutConfigWarnings();
}

/** Operator-facing sentence for a checkout that can't start. */
export function checkoutNotReadyText(): string {
  if (!usingStripe()) return checkoutNotReadyError();
  const missing = missingStripeVars();
  return missing.length
    ? `Los pagos con Stripe todavía no están activos: falta ${missing.join(', ')} en Vercel. Un admin puede activar tu plan directo.`
    : 'No pudimos iniciar el pago en este momento. No se hizo ningún cargo; inténtalo de nuevo más tarde.';
}

export interface StripeFormProps {
  publishableKey: string;
  mode: 'subscription' | 'setup';
  amountCents: number;
}

/** The Stripe form for a new charge, or undefined when this deployment sells through MP. */
export function stripeForm(chargeTodayCents: number, force = false): StripeFormProps | undefined {
  if (!force && !usingStripe()) return undefined;
  const key = stripePublishableKey();
  if (!key || (!force && !isStripeReady())) return undefined;
  return chargeTodayCents > 0
    ? { publishableKey: key, mode: 'subscription', amountCents: chargeTodayCents }
    : { publishableKey: key, mode: 'setup', amountCents: 0 };
}
