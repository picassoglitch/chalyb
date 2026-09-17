'use server';

// Mercado Pago subscription — the server function behind the card form on
// /app/subscription/checkout. The browser tokenises the card with the Card
// Payment Brick (the card number never touches our servers) and sends the
// single-use token here; this creates the preapproval already AUTHORISED
// (Mercado Pago charges the first month on the spot) and activates the tier.
//
// FLOW:
//   1. /app/subscription → "Cambiar a Pro" → /app/subscription/checkout?tier=PRO
//   2. The Brick tokenises the card → authorizeTierSubscription({ tier, cardTokenId })
//   3. This validates session + tier, creates the preapproval
//      (status "authorized", card_token_id), records it, and runs the same
//      sync the webhook runs, so the tier is active before the response.
//   4. Mercado Pago keeps charging monthly; `subscription_preapproval` and
//      `subscription_authorized_payment` notifications keep our copy honest.
//
// Price, currency and frequency come from TIER_PRICING on the server. The
// browser only names the tier and hands over a token. Tokens are never logged.
//
// HOSTED FALLBACK: startHostedTierSubscription creates the same preapproval
// WITHOUT a card token, status "pending", and returns its init_point. The
// user authorises the card on Mercado Pago's own page and comes back to
// /app/subscription; the `subscription_preapproval` webhook (and the sync on
// return) flips it to authorized and activates the tier. It is the way to
// pay when the in-app card form cannot load in someone's browser.
//
// ADMIN: admins change tiers directly in tier-actions.ts and get
// { ok: false, reason: 'admin_skip' } here, same as the token pack checkout.

import { getSessionUser, type SubscriptionTier } from '@/lib/auth/session';
import { isAdminRole } from '@/lib/billing/tiers';
import { createAdminClient } from '@/lib/supabase/admin';
import { TIER_PRICING } from './pricing';
import {
  getMercadoPago,
  getAppUrl,
  isCheckoutReady,
  checkoutNotReadyError,
  describeMpError,
} from './mercadopago';
import {
  isSubscribableTier,
  normalizePreapprovalStatus,
  subscriptionReference,
} from './subscription-reference';
import { cancelPreapproval, syncSubscription } from './subscription-sync';

export interface AuthorizeSubscriptionResult {
  ok: boolean;
  /** Mercado Pago's status after creation: authorized | pending | … */
  status?: string;
  reason?:
    | 'unauth'
    | 'not_subscribable'
    | 'not_configured'
    | 'admin_skip'
    | 'bad_token'
    | 'rejected'
    | 'mp_error';
  /** Human-readable message for the form. */
  error?: string;
}

interface PreparedSubscription {
  session: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;
  pricing: NonNullable<(typeof TIER_PRICING)[SubscriptionTier]>;
  payerEmail: string;
  admin: ReturnType<typeof createAdminClient>;
  externalReference: string;
}

type Prepared =
  | { ok: true; prepared: PreparedSubscription }
  | { ok: false; result: AuthorizeSubscriptionResult };

// Everything both checkouts decide before anything is created at Mercado
// Pago: who is paying, whether they may, what the plan costs, and that no
// second live subscription can come out of it.
async function prepareTierSubscription(targetTier: SubscriptionTier): Promise<Prepared> {
  const session = await getSessionUser();
  if (!session) {
    return {
      ok: false,
      result: { ok: false, reason: 'unauth', error: 'Inicia sesión para cambiar de plan.' },
    };
  }
  if (isAdminRole(session.role)) {
    return {
      ok: false,
      result: {
        ok: false,
        reason: 'admin_skip',
        error: 'Las cuentas admin cambian de plan directo, sin pasar por el cobro.',
      },
    };
  }
  if (!isSubscribableTier(targetTier)) {
    return {
      ok: false,
      result: {
        ok: false,
        reason: 'not_subscribable',
        error:
          targetTier === 'FREE'
            ? 'El plan Free es gratis, no necesitas pasar por el cobro.'
            : 'Ese plan no se vende por suscripción.',
      },
    };
  }
  const pricing = TIER_PRICING[targetTier];
  if (!pricing) {
    return {
      ok: false,
      result: { ok: false, reason: 'not_subscribable', error: 'Ese plan no tiene precio.' },
    };
  }
  if (!isCheckoutReady()) {
    console.error('[mp/subscription] refusing to start checkout:', checkoutNotReadyError());
    return {
      ok: false,
      result: { ok: false, reason: 'not_configured', error: checkoutNotReadyError() },
    };
  }
  const payerEmail = session.user.email;
  if (!payerEmail) {
    // Mercado Pago requires payer_email on a preapproval.
    return {
      ok: false,
      result: {
        ok: false,
        reason: 'mp_error',
        error: 'Tu cuenta no tiene correo; agrega uno en /app/settings antes de suscribirte.',
      },
    };
  }

  // ── One live preapproval per user ─────────────────────────────────
  // Decided on the server, from our copy of Mercado Pago's state, before
  // anything is created. A second submit while the first subscription is
  // still charging must not open a second one.
  const admin = createAdminClient();
  const { data: liveRows } = await admin
    .from('subscriptions')
    .select('mp_preapproval_id, tier, status')
    .eq('user_id', session.user.id)
    .in('status', ['pending', 'authorized']);
  for (const row of liveRows ?? []) {
    const id = row.mp_preapproval_id as string;
    // Our row may be stale; Mercado Pago is the source of truth.
    let status = normalizePreapprovalStatus(row.status as string);
    try {
      const synced = await syncSubscription(id);
      if (synced.ok) status = synced.status;
    } catch (err) {
      console.error('[mp/subscription] could not refresh an existing preapproval', id, err);
    }
    if (status === 'authorized' && row.tier === targetTier) {
      // Already paying for exactly this plan. Nothing to create.
      return {
        ok: false,
        result: { ok: true, status: 'authorized', error: 'Este plan ya está activo en tu cuenta.' },
      };
    }
    if (status === 'pending') {
      // A card-less preapproval (hosted flow) that was never authorised.
      // Nobody can complete it from here; close it at Mercado Pago so it
      // cannot become a second live subscription later.
      try {
        await cancelPreapproval(id);
        await admin
          .from('subscriptions')
          .update({ status: 'cancelled', ended_at: new Date().toISOString() })
          .eq('mp_preapproval_id', id);
      } catch (err) {
        console.error('[mp/subscription] could not close a stale pending preapproval', id, err);
        return {
          ok: false,
          result: {
            ok: false,
            reason: 'mp_error',
            error:
              'Tienes una suscripción pendiente que no pudimos cerrar en Mercado Pago. Inténtalo de nuevo en unos minutos.',
          },
        };
      }
    }
    // An authorised preapproval for ANOTHER tier is an upgrade/downgrade:
    // creating the new one is right, and syncSubscription cancels the old
    // one once the new one is authorised.
  }

  return {
    ok: true,
    prepared: {
      session,
      pricing,
      payerEmail,
      admin,
      externalReference: subscriptionReference(session.user.id, targetTier),
    },
  };
}

export async function authorizeTierSubscription(input: {
  tier: SubscriptionTier;
  cardTokenId: string;
}): Promise<AuthorizeSubscriptionResult> {
  // One try around everything, pre-flight included: a throw here would come
  // back as a generic server-function 500 and the client would only see
  // "This page couldn't load".
  try {
    const targetTier = input.tier;
    const cardTokenId = typeof input.cardTokenId === 'string' ? input.cardTokenId.trim() : '';
    if (!cardTokenId || cardTokenId.length > 128) {
      return {
        ok: false,
        reason: 'bad_token',
        error: 'El formulario no entregó una tarjeta válida. Inténtalo de nuevo.',
      };
    }

    const prep = await prepareTierSubscription(targetTier);
    if (!prep.ok) return prep.result;
    const { session, pricing, payerEmail, admin, externalReference } = prep.prepared;

    const { preapproval } = getMercadoPago();
    const result = await preapproval.create({
      body: {
        reason: pricing.description,
        external_reference: externalReference,
        payer_email: payerEmail,
        card_token_id: cardTokenId,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: pricing.amountCents / 100, // Mercado Pago wants major units
          currency_id: pricing.currency,
        },
        back_url: `${getAppUrl()}/app/subscription`,
        status: 'authorized',
      },
    });

    if (!result.id) {
      console.error('[mp/subscription] preapproval returned no id', {
        status: result.status ?? null,
      });
      return {
        ok: false,
        reason: 'mp_error',
        error: 'Mercado Pago no confirmó la suscripción. Inténtalo de nuevo en un momento.',
      };
    }

    // Our copy, written before the sync so a webhook racing us finds it.
    await admin.from('subscriptions').upsert(
      {
        user_id: session.user.id,
        tier: targetTier,
        mp_preapproval_id: result.id,
        external_reference: externalReference,
        status: normalizePreapprovalStatus(result.status),
        amount_cents: pricing.amountCents,
        currency: pricing.currency,
        next_payment_date: result.next_payment_date ?? null,
        raw: result as unknown as Record<string, unknown>,
      },
      { onConflict: 'mp_preapproval_id', ignoreDuplicates: true },
    );

    // Same path the webhook takes: fetch the preapproval, check the price,
    // apply the entitlement. Doing it here means the plan is active when the
    // form says so, not seconds later when the notification lands.
    const status = normalizePreapprovalStatus(result.status);
    try {
      await syncSubscription(result.id);
    } catch (err) {
      // The webhook will finish the job; the user's card was still authorised.
      console.error('[mp/subscription] immediate sync failed, webhook will retry', err);
    }

    if (status === 'authorized') return { ok: true, status };
    if (status === 'pending') {
      return {
        ok: true,
        status,
        error:
          'Mercado Pago dejó la suscripción pendiente de confirmación; tu plan se activa en cuanto la apruebe.',
      };
    }
    return {
      ok: false,
      reason: 'rejected',
      status,
      error: 'Mercado Pago no autorizó la tarjeta para el cobro mensual. Prueba con otra tarjeta.',
    };
  } catch (err) {
    console.error('[mp/subscription] preapproval.create failed', err);
    const detail = describeMpError(err);
    const isCurrencyError = /currency|currency_id|moneda/i.test(detail);
    const isPayerError = /payer|collector|test user|usuario de prueba/i.test(detail);
    const isCardError = /card|token|tarjeta/i.test(detail);
    const hint = isCurrencyError
      ? ' — tu cuenta de Mercado Pago seguramente solo acepta moneda local. Revisa `currency` en src/lib/payments/pricing.ts.'
      : isPayerError
        ? ' — con credenciales de prueba, el correo del usuario debe ser el de un usuario de prueba de Mercado Pago (ver docs/payments/mercadopago.md).'
        : isCardError
          ? ' — revisa los datos de la tarjeta o prueba con otra.'
          : '';
    return {
      ok: false,
      reason: 'mp_error',
      error: `Mercado Pago no pudo activar la suscripción: ${detail}${hint}`,
    };
  }
}

export interface HostedSubscriptionResult {
  ok: boolean;
  /** Mercado Pago's init_point: where the browser goes to authorise the card. */
  url?: string;
  reason?: AuthorizeSubscriptionResult['reason'];
  error?: string;
}

/** The Mercado Pago-hosted way to start a monthly plan: a pending
 *  preapproval with no card, whose init_point the browser navigates to.
 *  Same rules and same price as the in-app card form. */
export async function startHostedTierSubscription(input: {
  tier: SubscriptionTier;
}): Promise<HostedSubscriptionResult> {
  try {
    const targetTier = input.tier;
    const prep = await prepareTierSubscription(targetTier);
    if (!prep.ok) {
      const r = prep.result;
      if (r.ok) return { ok: false, reason: 'mp_error', error: r.error };
      return { ok: false, reason: r.reason, error: r.error };
    }
    const { session, pricing, payerEmail, admin, externalReference } = prep.prepared;

    const appUrl = getAppUrl();
    if (!appUrl.startsWith('https://')) {
      console.error(
        '[mp/subscription] NEXT_PUBLIC_APP_URL is HTTP — Mercado Pago rejects a non-HTTPS back_url.',
      );
    }

    const { preapproval } = getMercadoPago();
    const result = await preapproval.create({
      body: {
        reason: pricing.description,
        external_reference: externalReference,
        payer_email: payerEmail,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: pricing.amountCents / 100,
          currency_id: pricing.currency,
        },
        back_url: `${appUrl}/app/subscription?status=success`,
        status: 'pending',
      },
    });

    const url = result.init_point;
    if (!result.id || !url) {
      console.error('[mp/subscription] hosted preapproval returned no id/init_point', {
        id: result.id ?? null,
        status: result.status ?? null,
      });
      return {
        ok: false,
        reason: 'mp_error',
        error: 'Mercado Pago no devolvió la página de pago. Inténtalo de nuevo en un momento.',
      };
    }

    // Our copy, pending. The webhook (or the sync when the user comes back)
    // flips it to authorized and activates the tier.
    await admin.from('subscriptions').upsert(
      {
        user_id: session.user.id,
        tier: targetTier,
        mp_preapproval_id: result.id,
        external_reference: externalReference,
        status: normalizePreapprovalStatus(result.status),
        amount_cents: pricing.amountCents,
        currency: pricing.currency,
        next_payment_date: result.next_payment_date ?? null,
        raw: result as unknown as Record<string, unknown>,
      },
      { onConflict: 'mp_preapproval_id', ignoreDuplicates: true },
    );

    return { ok: true, url };
  } catch (err) {
    console.error('[mp/subscription] hosted preapproval.create failed', err);
    return {
      ok: false,
      reason: 'mp_error',
      error: `Mercado Pago no pudo abrir la página de pago: ${describeMpError(err)}`,
    };
  }
}
