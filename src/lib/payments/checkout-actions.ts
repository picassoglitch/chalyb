'use server';

// Mercado Pago checkout — server action that creates a Preference and
// returns the URL to redirect the user to. The actual tier write happens
// asynchronously in /api/mp/webhook after MP confirms the payment.
//
// FLOW:
//   1. User clicks "Cambiar a Pro" → calls createTierCheckout('PRO')
//   2. This action validates session + tier, builds a Preference, returns init_point
//   3. Client redirects window.location to init_point (MP-hosted checkout)
//   4. User pays on MP
//   5. MP redirects back to /app/billing?status=success
//   6. (Async) MP POSTs /api/mp/webhook → webhook verifies + writes profiles.tier
//
// ADMIN FALLBACK: admins still use the direct path in tier-actions.ts. This
// action returns { ok: false, reason: 'admin_skip' } if an admin calls it,
// so the UI knows to fall back.

import { getSessionUser, type SubscriptionTier } from '@/lib/auth/session';
import { isAdminRole } from '@/lib/billing/tiers';
import { TIER_PRICING } from './pricing';
import { getMercadoPago, getAppUrl, isMercadoPagoConfigured } from './mercadopago';

export interface CheckoutResult {
  ok: boolean;
  /** URL to redirect the browser to. Only present when ok=true. */
  url?: string;
  /** Error reason machine code: 'unauth' | 'free_tier' | 'not_configured' | 'admin_skip' | 'mp_error' */
  reason?: string;
  /** Human-readable error message for toast display. */
  error?: string;
}

export async function createTierCheckout(targetTier: SubscriptionTier): Promise<CheckoutResult> {
  // Top-level try wraps the pre-flight checks too — getSessionUser or any
  // import-time side effect could throw and bubble up as a 500 server
  // action response, which the user sees as Next's generic "page couldn't
  // load" page. Catching everything keeps the client's sticky-error path
  // alive even when the failure isn't strictly MP.
  try {
    const session = await getSessionUser();
    if (!session) {
      return { ok: false, reason: 'unauth', error: 'Inicia sesión para cambiar de plan.' };
    }

    // Admins bypass MP entirely — their tier changes through tier-actions.ts.
    if (isAdminRole(session.role)) {
      return { ok: false, reason: 'admin_skip', error: 'Las cuentas admin cambian de plan directo, sin pasar por el checkout.' };
    }

    // Downgrading to FREE doesn't need MP — that's just a tier write handled
    // by tier-actions.ts (no money changes hands).
    const pricing = TIER_PRICING[targetTier];
    if (!pricing) {
      return { ok: false, reason: 'free_tier', error: 'El plan Free es gratis, no necesitas pasar por el checkout.' };
    }

    if (!isMercadoPagoConfigured()) {
      return {
        ok: false,
        reason: 'not_configured',
        error:
          'Mercado Pago todavía no está listo. Pídele a un admin que active tu plan, o configura MP_ACCESS_TOKEN.',
      };
    }

    const { preference } = getMercadoPago();
    const appUrl = getAppUrl();

    // MP requires HTTPS for both auto_return AND notification_url. Local dev
    // with http://localhost fails the preference validation with a misleading
    // "back_url.success must be defined" error. Detect protocol and gracefully
    // drop the features that need HTTPS so dev still works without ngrok.
    const isHttps = appUrl.startsWith('https://');

    const body: Record<string, unknown> = {
      items: [
        {
          id: `tier-${targetTier.toLowerCase()}`,
          title: pricing.description,
          quantity: 1,
          unit_price: pricing.amountCents / 100, // MP wants major units
          currency_id: pricing.currency,
        },
      ],
      // external_reference is echoed back in webhook + redirect — we use
      // it to identify which user + which tier this payment is for.
      // Format: "<userId>|<tier>" — webhook parses on '|'.
      external_reference: `${session.user.id}|${targetTier}`,
      back_urls: {
        success: `${appUrl}/app/billing?status=success`,
        failure: `${appUrl}/app/subscription?status=failure`,
        pending: `${appUrl}/app/billing?status=pending`,
      },
      statement_descriptor: 'CHALYB',
      metadata: {
        user_id: session.user.id,
        target_tier: targetTier,
      },
    };

    if (isHttps) {
      // Auto-redirect after payment — only works with HTTPS back_urls.
      body.auto_return = 'approved';
      // Webhook for async tier write — MP can't POST to localhost.
      body.notification_url = `${appUrl}/api/mp/webhook`;
    } else {
      console.warn(
        '[mp/checkout] NEXT_PUBLIC_APP_URL is HTTP — skipping auto_return + webhook. ' +
          'Use ngrok or deploy to enable end-to-end flow.',
      );
    }

    // Cast — the SDK's PreferenceRequest type can't see that we always set
    // items above, but TS infers `body` as the loose Record we declared.
    const result = await preference.create({
      body: body as Parameters<typeof preference.create>[0]['body'],
    });

    // init_point = production checkout URL. sandbox_init_point = TEST mode.
    // The SDK picks one based on the token prefix (TEST-* vs APP_USR-*).
    const url = result.init_point ?? result.sandbox_init_point;
    if (!url) {
      console.error('[mp/checkout] preference returned no URL', result);
      return { ok: false, reason: 'mp_error', error: 'Mercado Pago no nos dio una URL de pago. Inténtalo de nuevo en un momento.' };
    }

    return { ok: true, url };
  } catch (err) {
    // MP SDK throws an ApiError shape with rich detail. We log the WHOLE thing
    // to the terminal so the dev can see the actual cause, then extract the
    // most useful field for the user-facing toast.
    console.error('[mp/checkout] preference.create failed', err);

    // Pull message from MP's typical error shapes (in order of richness):
    //   - err.cause?.error?.message    (MP API ApiError v2 shape)
    //   - err.cause?.message
    //   - err.message
    //   - JSON stringification fallback
    const e = err as {
      message?: string;
      cause?: { error?: { message?: string; cause?: unknown[] }; message?: string };
      status?: number;
    };
    const detail =
      e?.cause?.error?.message ||
      e?.cause?.message ||
      e?.message ||
      'sin detalle';

    // Common error: USD currency rejected because MP account is country-locked
    // (most LatAm accounts only allow their local currency). Suggest a fix.
    const isCurrencyError = /currency|currency_id|moneda/i.test(detail);
    const hint = isCurrencyError
      ? ' — tu cuenta de Mercado Pago seguramente solo acepta moneda local (MXN/ARS/BRL). Cambia `currency` en src/lib/payments/pricing.ts.'
      : '';

    return {
      ok: false,
      reason: 'mp_error',
      error: `Mercado Pago no pudo abrir el checkout: ${detail}${hint}`,
    };
  }
}
