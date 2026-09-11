'use server';

// Mercado Pago checkout for token top-up packs. Parallel to createTierCheckout
// (which sells tier subscriptions) but the post-payment effect is different:
// instead of bumping profiles.tier, the webhook calls grantTokenPack() to
// add to profiles.token_bonus_balance.
//
// FLOW:
//   1. User clicks "Comprar +500k tokens" → calls createTokenPackCheckout('tokens_500k')
//   2. Server creates MP Preference, returns init_point URL
//   3. Browser navigates to MP checkout
//   4. User pays
//   5. MP redirects back to /app/usage?status=success
//   6. (Async) MP webhook → fires with external_reference="pack|<userId>|<packId>"
//   7. Webhook detects 'pack' prefix and routes to grantTokenPack instead of
//      tier change. See app/api/mp/webhook/route.ts.
//
// Admins still pay for packs (we don't comp them via this path) but they
// don't NEED to — admins have unlimited via getTokenBalance. The button on
// /app/usage is hidden for admins.

import { getSessionUser } from '@/lib/auth/session';
import { isAdminRole } from '@/lib/billing/tiers';
import { TOKEN_PACKS, getTokenPack } from './pricing';
import { getMercadoPago, getAppUrl, isMercadoPagoConfigured } from './mercadopago';

export interface PackCheckoutResult {
  ok: boolean;
  url?: string;
  reason?: 'unauth' | 'admin_skip' | 'unknown_pack' | 'not_configured' | 'mp_error';
  error?: string;
}

export async function createTokenPackCheckout(
  packId: string,
): Promise<PackCheckoutResult> {
  // Top-level try wraps EVERYTHING — including the pre-flight checks. The
  // previous version had try/catch only around the MP call, so a thrown
  // exception from getSessionUser / isMercadoPagoConfigured / config
  // initialization would escape and Next.js would 500 the server action
  // (visible to the user as "This page couldn't load"). Now any thrown
  // value short-circuits to a structured PackCheckoutResult the client
  // can render in its sticky-error panel.
  try {
    const session = await getSessionUser();
    if (!session) {
      return { ok: false, reason: 'unauth', error: 'Inicia sesión para comprar tokens.' };
    }
    // Admins don't need packs. If we let them buy anyway it'd be confusing.
    if (isAdminRole(session.role)) {
      return {
        ok: false,
        reason: 'admin_skip',
        error: 'Como admin tienes tokens ilimitados — no necesitas comprar packs.',
      };
    }

    const pack = getTokenPack(packId);
    if (!pack) {
      return { ok: false, reason: 'unknown_pack', error: `Pack desconocido: ${packId}` };
    }

    if (!isMercadoPagoConfigured()) {
      return {
        ok: false,
        reason: 'not_configured',
        error: 'Mercado Pago no está configurado. Pide a un admin que active tu pack.',
      };
    }

    const { preference } = getMercadoPago();
    const appUrl = getAppUrl();
    const isHttps = appUrl.startsWith('https://');

    // external_reference shape: "pack|<userId>|<packId>" so the webhook can
    // distinguish from tier upgrades (which use "<userId>|<tier>").
    const body: Record<string, unknown> = {
      items: [
        {
          id: `pack-${pack.id}`,
          title: `Chalyb · ${pack.label}`,
          quantity: 1,
          unit_price: pack.amountCents / 100,
          currency_id: 'MXN',
        },
      ],
      external_reference: `pack|${session.user.id}|${pack.id}`,
      back_urls: {
        success: `${appUrl}/app/usage?status=success`,
        failure: `${appUrl}/app/usage?status=failure`,
        pending: `${appUrl}/app/usage?status=pending`,
      },
      statement_descriptor: 'CHALYB TOKENS',
      metadata: {
        user_id: session.user.id,
        pack_id: pack.id,
        tokens_granted: pack.tokens,
        kind: 'token_pack',
      },
    };

    if (isHttps) {
      body.auto_return = 'approved';
      body.notification_url = `${appUrl}/api/mp/webhook`;
    }

    const result = await preference.create({
      body: body as Parameters<typeof preference.create>[0]['body'],
    });
    const url = result.init_point ?? result.sandbox_init_point;
    if (!url) {
      return { ok: false, reason: 'mp_error', error: 'MP no devolvió URL de checkout.' };
    }
    return { ok: true, url };
  } catch (err) {
    // Log to Vercel server logs with enough context to debug — we lose
    // the raw stack in production builds but the structured fields survive.
    const e = err as {
      message?: string;
      status?: number;
      cause?: { error?: { message?: string }; status?: number };
      name?: string;
    };
    const detail =
      e?.cause?.error?.message ||
      e?.message ||
      e?.name ||
      'unknown server error in token-pack-checkout';
    console.error('[token-pack-checkout] uncaught', {
      packId,
      errorName: e?.name,
      errorMessage: e?.message,
      causeStatus: e?.cause?.status,
      causeMessage: e?.cause?.error?.message,
    });
    return { ok: false, reason: 'mp_error', error: detail };
  }
}

// Note: TOKEN_PACKS used to be re-exported here for the /app/usage page,
// but Next.js refuses to compile a "use server" file that exports anything
// except async functions ("found object" — TOKEN_PACKS is an array). The
// re-export was redundant anyway since the page can — and does — import
// TOKEN_PACKS directly from '@/lib/payments/pricing'.
