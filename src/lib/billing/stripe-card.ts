// "Cambiar tarjeta" for a Stripe subscription: the new card is set up in-site (3DS by
// Stripe), becomes the subscription's, and an open invoice is retried on it right away.

import 'server-only';
import type Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe, stripeReturnUrl } from '@/lib/payments/stripe';
import { stripeDeclineReason } from '@/lib/payments/stripe-config';
import { declineCodeOf } from '@/lib/payments/stripe-mapping';
import type { DeclineReason } from '@/lib/payments/card-decline';

export type CardUpdateResult =
  | { ok: true }
  | { ok: false; code: 'REQUIRES_ACTION'; clientSecret: string; subscriptionId: string }
  | { ok: false; code: 'DECLINED'; decline: DeclineReason }
  | { ok: false; code: 'NOTHING_TO_UPDATE' | 'BAD_TOKEN' | 'MP_ERROR' };

async function customerOf(userId: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from('stripe_customers')
    .select('customer_id')
    .eq('user_id', userId)
    .maybeSingle();
  return (data?.customer_id as string | undefined) ?? null;
}

export async function updateStripeCard(
  userId: string,
  subscriptionId: string,
  confirmationToken: string,
): Promise<CardUpdateResult> {
  const customer = await customerOf(userId);
  if (!customer) return { ok: false, code: 'NOTHING_TO_UPDATE' };
  let si: Stripe.SetupIntent;
  try {
    si = await getStripe().setupIntents.create(
      {
        customer,
        confirm: true,
        confirmation_token: confirmationToken,
        usage: 'off_session',
        allowed_payment_method_types: ['card'],
        return_url: stripeReturnUrl('/app/billing'),
        metadata: { user_id: userId, subscription_id: subscriptionId },
      },
      { idempotencyKey: `chalyb-card-${userId}-${confirmationToken}` },
    );
  } catch (err) {
    const e = err as { decline_code?: string; code?: string; type?: string };
    console.error('[billing/card] stripe setup refused', {
      code: e.code,
      decline_code: e.decline_code,
    });
    if (e.code === 'resource_missing') return { ok: false, code: 'BAD_TOKEN' };
    if (e.type === 'StripeCardError' || e.decline_code) {
      return { ok: false, code: 'DECLINED', decline: stripeDeclineReason(declineCodeOf(e)) };
    }
    return { ok: false, code: 'MP_ERROR' };
  }
  return applySetup(userId, subscriptionId, si);
}

/** After the browser ran 3DS for a card update. */
export async function finishStripeCardUpdate(
  userId: string,
  subscriptionId: string,
  setupIntentId: string,
): Promise<CardUpdateResult> {
  const customer = await customerOf(userId);
  if (!customer || !setupIntentId.startsWith('seti_'))
    return { ok: false, code: 'NOTHING_TO_UPDATE' };
  const si = await getStripe().setupIntents.retrieve(setupIntentId);
  const siCustomer = typeof si.customer === 'string' ? si.customer : si.customer?.id;
  if (siCustomer !== customer || si.metadata?.subscription_id !== subscriptionId) {
    return { ok: false, code: 'NOTHING_TO_UPDATE' };
  }
  return applySetup(userId, subscriptionId, si);
}

async function applySetup(
  userId: string,
  subscriptionId: string,
  si: Stripe.SetupIntent,
): Promise<CardUpdateResult> {
  if (si.status === 'requires_action' && si.client_secret) {
    return { ok: false, code: 'REQUIRES_ACTION', clientSecret: si.client_secret, subscriptionId };
  }
  if (si.status !== 'succeeded') {
    return {
      ok: false,
      code: 'DECLINED',
      decline: stripeDeclineReason(declineCodeOf(si.last_setup_error)),
    };
  }
  const stripe = getStripe();
  const pmId = typeof si.payment_method === 'string' ? si.payment_method : si.payment_method?.id;
  if (!pmId) return { ok: false, code: 'MP_ERROR' };
  const sub = await stripe.subscriptions.update(subscriptionId, {
    default_payment_method: pmId,
    expand: ['latest_invoice'],
  });
  const pm = await stripe.paymentMethods.retrieve(pmId);
  const { error: rowErr } = await createAdminClient()
    .from('subscriptions')
    .update({
      card_brand: pm.card?.brand ?? null,
      card_last4: pm.card?.last4 ?? null,
      card_exp:
        pm.card?.exp_month && pm.card?.exp_year
          ? `${String(pm.card.exp_month).padStart(2, '0')}/${String(pm.card.exp_year).slice(-2)}`
          : null,
    })
    .eq('mp_preapproval_id', subscriptionId)
    .eq('user_id', userId);
  if (rowErr) console.error('[billing/card] card details not stored', subscriptionId, rowErr);
  // A past-due plan is retried on the new card now, not at Stripe's next retry.
  const invoice = typeof sub.latest_invoice === 'object' ? sub.latest_invoice : null;
  if (invoice?.status === 'open' && invoice.id) {
    try {
      await stripe.invoices.pay(invoice.id, { payment_method: pmId });
    } catch (err) {
      const e = err as { decline_code?: string; code?: string; type?: string };
      console.error('[billing/card] open invoice retry failed', invoice.id, e.code, e.decline_code);
      // The card is saved, but the debt is still there: say so instead of "listo".
      if (e.type === 'StripeCardError' || e.decline_code) {
        return { ok: false, code: 'DECLINED', decline: stripeDeclineReason(declineCodeOf(e)) };
      }
    }
  }
  return { ok: true };
}
