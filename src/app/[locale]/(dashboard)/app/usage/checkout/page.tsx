import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { isAdminRole } from '@/lib/billing/tiers';
import { TOKEN_PACK_CURRENCY, formatMoney, getTokenPack } from '@/lib/payments/pricing';
import {
  checkoutConfigWarnings,
  checkoutNotReadyError,
  getPublicKey,
  missingCheckoutVars,
} from '@/lib/payments/mercadopago';
import { PackCheckout } from '@/components/workspace/pack-checkout';

export const metadata = { title: 'Comprar tokens' };

// /app/usage/checkout?pack=tokens_500k — the card form for a token pack.
// The pack and its price are decided here; the browser only hands back a
// card token.
export default async function PackCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ pack?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { pack: packParam } = await searchParams;

  const session = await getSessionUser();
  if (!session) redirect(`/sign-in?next=/app/usage/checkout?pack=${packParam ?? ''}`);
  if (isAdminRole(session.role)) redirect('/app/usage' as Route);

  const pack = getTokenPack(packParam ?? '');
  if (!pack) redirect('/app/usage' as Route);

  const missing = missingCheckoutVars();
  const publicKey = getPublicKey();
  // Set-but-wrong credentials leave the Brick loading forever; say so here,
  // before the form, instead of after its 20 s watchdog.
  const problems = missing.length === 0 ? checkoutConfigWarnings() : [];

  return (
    <div className="cc-scroll">
      <div className="cc-mod-section" style={{ maxWidth: 560 }}>
        <div className="cc-mod-sl">Comprar {pack.label}</div>

        <div className="cc-mod-card" style={{ marginBottom: 16 }}>
          <div className="cc-mod-card-head">
            <span
              className="cc-mod-tag"
              style={{ fontSize: 13, color: 'var(--cc-txt)', fontWeight: 600 }}
            >
              {pack.tokens.toLocaleString('es-MX')} tokens
            </span>
            <span className="cc-mod-badge gr">pago único</span>
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
            {formatMoney(pack.amountCents, TOKEN_PACK_CURRENCY)}
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--cc-txt-3)', marginTop: 8, lineHeight: 1.5 }}>
            {pack.tagline}. Los tokens no caducan y se suman a los de tu plan.
          </p>
        </div>

        {missing.length > 0 || !publicKey || problems.length > 0 ? (
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
            {problems.length > 0 ? problems.join('. ') + '.' : checkoutNotReadyError()}
          </div>
        ) : (
          <PackCheckout
            packId={pack.id}
            packLabel={pack.label}
            publicKey={publicKey}
            amountMajor={pack.amountCents / 100}
            payerEmail={session.user.email ?? null}
          />
        )}

        <p style={{ fontSize: 11.5, color: 'var(--cc-txt-4)', marginTop: 14, lineHeight: 1.5 }}>
          Los datos de tu tarjeta viajan directo a Mercado Pago en campos seguros; Chalyb nunca los
          ve ni los guarda.{' '}
          <Link href={'/app/usage' as Route} style={{ color: 'var(--cc-txt-3)' }}>
            ← Volver
          </Link>
        </p>
      </div>
    </div>
  );
}
