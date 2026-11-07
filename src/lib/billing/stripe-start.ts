// The Stripe half of starting a subscription: the card from a ConfirmationToken, the
// subscription created incomplete, then its first payment (or trial setup) confirmed in-site.

import 'server-only';
import { createHash } from 'node:crypto';
import type Stripe from 'stripe';
import type { PlanKey } from '@/config/pricing';
import { PLAN_NAMES } from '@/lib/billing/plan-names';
import {
  ensureStripeCustomer,
  getStripe,
  invoicePaymentIntentId,
  stripePriceFor,
  stripeReturnUrl,
} from '@/lib/payments/stripe';
import { stripeDeclineReason } from '@/lib/payments/stripe-config';
import { declineCodeOf } from '@/lib/payments/stripe-mapping';
import type { DeclineReason } from '@/lib/payments/card-decline';

export interface StripeCard {
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  /** sha256 of Stripe's card fingerprint: the one-trial-per-card key. */
  fingerprint: string | null;
}

/** What the card form tokenised, read back on the server. null = not a usable token. */
/** Throws when Stripe can't be reached: an outage is not a bad card. */
export async function readConfirmationToken(id: string): Promise<StripeCard | null> {
  try {
    const ct = await getStripe().confirmationTokens.retrieve(id);
    const c = ct.payment_method_preview?.card;
    if (!c) return null;
    return {
      brand: c.brand ?? null,
      last4: c.last4 ?? null,
      expMonth: c.exp_month ?? null,
      expYear: c.exp_year ?? null,
      fingerprint: c.fingerprint
        ? createHash('sha256').update(`stripe|${c.fingerprint}`).digest('hex')
        : null,
    };
  } catch (err) {
    const e = err as { statusCode?: number; type?: string };
    if (e.type !== 'StripeInvalidRequestError' && e.statusCode !== 404) throw err;
    console.error('[stripe/start] confirmation token unreadable', err);
    return null;
  }
}

/** What a start's confirm and finalize read off the subscription. */
export const STRIPE_START_EXPAND = [
  'latest_invoice.payments',
  'latest_invoice.confirmation_secret',
  'pending_setup_intent',
];

/** What finalize needs to finish a start that waited on 3DS. Short keys: 500-char metadata cap. */
export interface StartMeta {
  m: 'trial' | 'paid' | 'change';
  ts: 0 | 1;
  sm: 0 | 1;
  fp: string;
  ss: string;
  /** Proration refund of a change, run once the new plan is paid. */
  rp?: string;
  rc?: number;
}

export async function createStripeSubscription(input: {
  user: { id: string; email: string; name: string | null };
  planKey: PlanKey;
  reference: string;
  /** Unix seconds of the first charge when it is not today (trial, scheduled change). */
  firstChargeAt: number | null;
  confirmationToken: string;
  meta: StartMeta;
}): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  const customer = await ensureStripeCustomer(input.user);
  const { id: price } = await stripePriceFor(input.planKey);
  return stripe.subscriptions.create(
    {
      customer,
      items: [{ price }],
      description: `Chalyb ${PLAN_NAMES[input.planKey]}`,
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
        payment_method_types: ['card'],
      },
      ...(input.firstChargeAt
        ? {
            trial_end: input.firstChargeAt,
            trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
          }
        : {}),
      metadata: {
        external_reference: input.reference,
        user_id: input.user.id,
        plan_key: input.planKey,
        chalyb_start: JSON.stringify(input.meta),
      },
      expand: STRIPE_START_EXPAND,
    },
    // A double submit of the same card form gets the same subscription back.
    { idempotencyKey: `chalyb-sub-${input.user.id}-${input.confirmationToken}` },
  );
}

export type ConfirmOutcome =
  | { kind: 'succeeded' }
  | { kind: 'action'; clientSecret: string }
  | { kind: 'declined'; decline: DeclineReason };

/** Confirms the first invoice's payment, or the trial's card setup, with the form's token. */
export async function confirmStripeStart(
  sub: Stripe.Subscription,
  confirmationToken: string,
): Promise<ConfirmOutcome> {
  const stripe = getStripe();
  const returnUrl = stripeReturnUrl('/app/billing');
  try {
    const setup = sub.pending_setup_intent;
    if (setup) {
      const id = typeof setup === 'string' ? setup : setup.id;
      const si = await stripe.setupIntents.confirm(id, {
        confirmation_token: confirmationToken,
        return_url: returnUrl,
      });
      return setupOutcome(sub.id, si);
    }
    const piId = invoicePaymentIntentId(
      typeof sub.latest_invoice === 'object' ? sub.latest_invoice : null,
    );
    // A trial or a scheduled change with nothing to collect now: nothing to confirm.
    if (!piId) return sub.status === 'trialing' ? { kind: 'succeeded' } : declined(null);
    const pi = await stripe.paymentIntents.confirm(piId, {
      confirmation_token: confirmationToken,
      return_url: returnUrl,
    });
    return intentOutcome(pi);
  } catch (err) {
    const e = err as { decline_code?: string; code?: string; type?: string };
    console.error('[stripe/start] confirm failed', { code: e.code, decline_code: e.decline_code });
    if (e.type === 'StripeCardError' || e.decline_code) return declined(declineCodeOf(e));
    throw err;
  }
}

/** Confirm; on an error that is not a decline (a timeout may have charged anyway) read the
 *  truth back. null = still unknown: nothing may be cancelled. */
export async function confirmOrReadBack(
  sub: Stripe.Subscription,
  confirmationToken: string,
): Promise<ConfirmOutcome | null> {
  try {
    return await confirmStripeStart(sub, confirmationToken);
  } catch (err) {
    console.error('[stripe/start] confirm failed, reading the state back', sub.id, err);
  }
  try {
    const fresh = await getStripe().subscriptions.retrieve(sub.id, { expand: STRIPE_START_EXPAND });
    return await stripeStartState(fresh);
  } catch (err) {
    console.error('[stripe/start] state unreadable', sub.id, err);
    return null;
  }
}

/** The state of a start after the browser ran 3DS (finalize). */
export async function stripeStartState(sub: Stripe.Subscription): Promise<ConfirmOutcome> {
  const stripe = getStripe();
  const setup = sub.pending_setup_intent;
  if (setup) {
    const si = typeof setup === 'string' ? await stripe.setupIntents.retrieve(setup) : setup;
    return setupOutcome(sub.id, si);
  }
  if (sub.status === 'trialing' && !sub.default_payment_method) return adoptTrialCard(sub);
  if (sub.status === 'active' || sub.status === 'trialing') return { kind: 'succeeded' };
  const piId = invoicePaymentIntentId(
    typeof sub.latest_invoice === 'object' ? sub.latest_invoice : null,
  );
  if (!piId) return declined(null);
  return intentOutcome(await stripe.paymentIntents.retrieve(piId));
}

/** A trial whose setup finished in the browser: its card becomes the subscription's. */
async function adoptTrialCard(sub: Stripe.Subscription): Promise<ConfirmOutcome> {
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const list = await getStripe().setupIntents.list({ customer, limit: 5 });
  const si = list.data.find((s) => s.status === 'succeeded' && s.created >= sub.created);
  return si ? setupOutcome(sub.id, si) : declined(null);
}

async function setupOutcome(subId: string, si: Stripe.SetupIntent): Promise<ConfirmOutcome> {
  if (si.status === 'succeeded') {
    const pm = typeof si.payment_method === 'string' ? si.payment_method : si.payment_method?.id;
    // The trial only counts once its card is the subscription's (snapshotFromStripe).
    if (pm) await getStripe().subscriptions.update(subId, { default_payment_method: pm });
    return { kind: 'succeeded' };
  }
  if (si.status === 'requires_action' && si.client_secret) {
    return { kind: 'action', clientSecret: si.client_secret };
  }
  return declined(declineCodeOf(si.last_setup_error));
}

function intentOutcome(pi: Stripe.PaymentIntent): ConfirmOutcome {
  if (pi.status === 'succeeded' || pi.status === 'processing') return { kind: 'succeeded' };
  if (pi.status === 'requires_action' && pi.client_secret) {
    return { kind: 'action', clientSecret: pi.client_secret };
  }
  return declined(declineCodeOf(pi.last_payment_error));
}

function declined(code: string | null): ConfirmOutcome {
  return { kind: 'declined', decline: stripeDeclineReason(code) };
}

export function parseStartMeta(raw: string | undefined): StartMeta | null {
  if (!raw) return null;
  try {
    const m = JSON.parse(raw) as StartMeta;
    return m && (m.m === 'trial' || m.m === 'paid' || m.m === 'change') ? m : null;
  } catch {
    return null;
  }
}
