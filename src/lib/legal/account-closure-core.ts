// Closing an account from Mi cuenta (Términos y Condiciones §13.1; Términos
// de los Paquetes §5.2). Pure: what the screen shows and what the request
// says. The server side is account-closure.ts.
//
// §5.2: before confirming, the person sees how many extra (pack) credits are
// unused and that they are lost. A number we can't read is never shown as 0:
// the screen says so and the closure waits (fail closed).

import type { BillingStateName } from '@/lib/billing/billing-state';

/** States with a plan that still charges: closing cancels it first. */
export const CHARGING_STATES: readonly BillingStateName[] = ['trialing', 'pro', 'past_due'];

export type ClosurePlan =
  | { kind: 'none' }
  /** Cancelled already; access runs to `until` (no more charges). */
  | { kind: 'ending'; until: string | null }
  /** Still charging: the closure cancels it at Mercado Pago first. */
  | { kind: 'charging'; state: BillingStateName; until: string | null };

export function closurePlan(primary: {
  state: BillingStateName;
  trialEndsAt: string | null;
  nextChargeAt: string | null;
  graceEndsAt: string | null;
  accessUntil: string | null;
}): ClosurePlan {
  if (primary.state === 'cancelled_active') return { kind: 'ending', until: primary.accessUntil };
  if (!CHARGING_STATES.includes(primary.state)) return { kind: 'none' };
  const until =
    primary.state === 'trialing'
      ? primary.trialEndsAt
      : primary.state === 'past_due'
        ? primary.graceEndsAt
        : primary.nextChargeAt;
  return { kind: 'charging', state: primary.state, until };
}

export type ClosureRefusal =
  /** The unused credits couldn't be read: §5.2 needs the number. */
  | 'credits_unknown'
  /** The number changed since the screen showed it: show it again. */
  | 'credits_changed'
  /** The warning box wasn't ticked. */
  | 'not_confirmed'
  /** A closure request is already open. */
  | 'already_requested';

/** Whether a confirmation may go ahead, given what the server reads now. */
export function closureRefusal(input: {
  creditsNow: number | null;
  creditsShown: unknown;
  confirmed: unknown;
  openRequest: boolean;
}): ClosureRefusal | null {
  if (input.openRequest) return 'already_requested';
  if (input.creditsNow === null) return 'credits_unknown';
  if (input.creditsShown !== input.creditsNow) return 'credits_changed';
  if (input.confirmed !== true) return 'not_confirmed';
  return null;
}

/** The ARCO cancellation request's text, for the privacy team (Spanish). */
export function closureRequestText(v: {
  credits: number;
  plan: ClosurePlan;
  cancelFolio: string | null;
}): string {
  const plan =
    v.plan.kind === 'charging'
      ? `Plan cancelado al pedir el cierre (folio ${v.cancelFolio ?? 'sin folio'}); sin más cobros.`
      : v.plan.kind === 'ending'
        ? 'Plan ya cancelado antes; sin más cobros.'
        : 'Sin plan de pago.';
  return [
    'Cierre de cuenta pedido desde Mi cuenta (Términos y Condiciones §13.1).',
    `Créditos extra sin usar mostrados y aceptados como perdidos al cerrar (Paquetes §5.2): ${v.credits}.`,
    plan,
  ].join('\n');
}
