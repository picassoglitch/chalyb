import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import { getSessionUser, type SubscriptionTier } from '@/lib/auth/session';
import { TIER_CAPS, isAdminRole } from '@/lib/billing/tiers';
import { TIER_PRICING, formatMoney } from '@/lib/payments/pricing';
import {
  checkoutNotReadyError,
  getPublicKey,
  missingCheckoutVars,
} from '@/lib/payments/mercadopago';
import { isSubscribableTier } from '@/lib/payments/subscription-reference';
import { SubscriptionCheckout } from '@/components/workspace/subscription-checkout';

export const metadata = { title: 'Activar plan' };

// /app/subscription/checkout?tier=PRO — the card form for a monthly plan.
// The page decides everything the browser must not: who is paying, what,
// and how much. The client component only renders the form and relays the
// card token to authorizeTierSubscription.
export default async function SubscriptionCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tier?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { tier: tierParam } = await searchParams;

  const session = await getSessionUser();
  if (!session) redirect(`/sign-in?next=/app/subscription/checkout?tier=${tierParam ?? ''}`);

  const tier = (tierParam ?? '').toUpperCase() as SubscriptionTier;
  if (!isSubscribableTier(tier) || !TIER_PRICING[tier]) redirect('/app/subscription' as Route);
  // Admins do not pay; the plan cards apply their change directly.
  if (isAdminRole(session.role)) redirect('/app/subscription' as Route);
  if (session.tier === tier && !session.tierEndsAt) redirect('/app/subscription' as Route);

  const pricing = TIER_PRICING[tier]!;
  const caps = TIER_CAPS[tier];
  const missing = missingCheckoutVars();
  const publicKey = getPublicKey();

  return (
    <div className="cc-scroll">
      <div className="cc-mod-section" style={{ maxWidth: 560 }}>
        <div className="cc-mod-sl">Activar plan {caps.label}</div>

        <div className="cc-mod-card" style={{ marginBottom: 16 }}>
          <div className="cc-mod-card-head">
            <span
              className="cc-mod-tag"
              style={{ fontSize: 13, color: 'var(--cc-txt)', fontWeight: 600 }}
            >
              {caps.label}
            </span>
            <span className="cc-mod-badge gr">cobro mensual</span>
          </div>
          <div
            style={{
              fontFamily: 'var(--cc-disp), sans-serif',
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            {formatMoney(pricing.amountCents, pricing.currency)}
            <span
              style={{ fontSize: 13, color: 'var(--cc-txt-3)', fontWeight: 500, marginLeft: 4 }}
            >
              /mes
            </span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--cc-txt-3)', marginTop: 8, lineHeight: 1.5 }}>
            Se cobra hoy y después cada mes a la misma tarjeta. Cancelas cuando quieras desde{' '}
            <Link href={'/app/subscription' as Route} style={{ color: 'var(--cc-txt-2)' }}>
              tu suscripción
            </Link>{' '}
            y conservas el plan hasta el final del período pagado.
          </p>
        </div>

        {missing.length > 0 || !publicKey ? (
          <div
            style={{
              padding: '12px 14px',
              border: '1px solid var(--cc-amber)',
              background: 'var(--cc-amber-g)',
              borderRadius: 9,
              fontSize: 12.5,
              color: 'var(--cc-txt-2)',
              lineHeight: 1.5,
            }}
          >
            <b style={{ display: 'block', marginBottom: 3, color: 'var(--cc-amber)' }}>
              Pagos aún no disponibles
            </b>
            {checkoutNotReadyError()}
          </div>
        ) : (
          <SubscriptionCheckout
            tier={tier}
            tierLabel={caps.label}
            publicKey={publicKey}
            amountMajor={pricing.amountCents / 100}
            payerEmail={session.user.email ?? null}
          />
        )}

        <p style={{ fontSize: 11.5, color: 'var(--cc-txt-4)', marginTop: 14, lineHeight: 1.5 }}>
          Los datos de tu tarjeta viajan directo a Mercado Pago en campos seguros; Chalyb nunca los
          ve ni los guarda.{' '}
          <Link href={'/app/subscription' as Route} style={{ color: 'var(--cc-txt-3)' }}>
            ← Volver
          </Link>
        </p>
      </div>
    </div>
  );
}
