import type { Metadata, Route } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { TriangleAlert } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { isAdminRole } from '@/lib/billing/tiers';
import { formatMXN } from '@/lib/billing/format';
import { getTokenPack } from '@/lib/payments/pricing';
import { loadPricedPacks, packTermsText } from '@/lib/payments/pack-prices';
import { packConsentSentence, termsShowPrice } from '@/lib/payments/pack-checkout-core';
import { packCheckoutTranslator, packDisclosure } from '@/lib/payments/pack-consent';
import {
  checkoutConfigWarnings,
  checkoutNotReadyError,
  getPublicKey,
  missingCheckoutVars,
  mpPayerEmail,
} from '@/lib/payments/mercadopago';
import { INVOICE_EMAIL } from '@/config/invoicing';
import { Markup } from '@/components/ui/markup';
import { Pill, StateBlock } from '@/components/ui/primitives';
import { PackCheckout } from '@/components/workspace/pack-checkout';
import { paidCheckoutEnabled } from '@/lib/config/flags';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('packCheckout');
  return { title: t('metaTitle') };
}

export const dynamic = 'force-dynamic';

// /app/usage/checkout?pack=tokens_500k — paying for a credit pack.
// The pack and its total are decided here, from the owner's pack prices
// (pack-prices.ts); the browser ticks the Paquetes box and hands back a card
// token, and the server checks both again before charging (pack-checkout-
// core.ts). The checkbox sentence is rendered here once and is the same
// text the consent evidence stores.
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

  // Sales are closed while paid checkout is off; the actions refuse too.
  if (!paidCheckoutEnabled()) redirect('/app/usage' as Route);

  const pack = getTokenPack(packParam ?? '');
  if (!pack) redirect('/app/usage' as Route);

  const t = await getTranslations('packCheckout');
  const tm = await packCheckoutTranslator(locale);
  const priced = await loadPricedPacks();
  const cents = priced ? priced.totals[pack.id] : null;
  const terms = priced ? packTermsText(priced.totals) : null;

  const missing = missingCheckoutVars();
  const publicKey = getPublicKey();
  // Set-but-wrong credentials leave the Brick loading forever; say so here,
  // before the form, instead of after its 20 s watchdog.
  const problems = missing.length === 0 ? checkoutConfigWarnings() : [];
  const n = pack.tokens.toLocaleString(locale === 'es' ? 'es-MX' : 'en-US');
  const b = (c: string) => `<b>${c}</b>`;

  // No price in force, or terms that promise another one: nothing to sell.
  if (cents === null || terms === null || !termsShowPrice(terms, cents)) {
    return (
      <div style={{ display: 'grid', gap: 22, maxWidth: 560, width: '100%' }}>
        <h1 className="ch-h1">{t('title', { n })}</h1>
        <StateBlock
          icon={<TriangleAlert />}
          title={t('unavailableTitle')}
          body={t('unavailable')}
          action={{ href: '/app/usage', label: t('back') }}
          role="alert"
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 22, maxWidth: 560, width: '100%' }}>
      <header>
        <Link href={'/app/usage' as Route} className="ch-muted" style={{ fontSize: 17 }}>
          ‹ {t('back')}
        </Link>
        <h1 className="ch-h1">{t('title', { n })}</h1>
      </header>

      <section className="ch-card" aria-labelledby="pk-total" style={{ display: 'grid', gap: 8 }}>
        <div>
          <Pill kind="acc">{t('once')}</Pill>
        </div>
        <p id="pk-total" style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1, margin: 0 }}>
          {formatMXN(cents)} MXN
        </p>
        <p className="ch-muted" style={{ margin: 0 }}>
          {t('ivaIncluded')}
        </p>
        <p style={{ margin: 0 }}>
          <Markup text={packDisclosure(tm, { cents, tokens: pack.tokens, locale })} />
        </p>
        <p className="ch-muted" style={{ margin: 0 }}>
          {t('lead')}
        </p>
      </section>

      {missing.length > 0 || !publicKey || problems.length > 0 ? (
        <StateBlock
          icon={<TriangleAlert />}
          title={t('unavailableTitle')}
          body={problems.length > 0 ? problems.join('. ') + '.' : checkoutNotReadyError()}
          role="alert"
        />
      ) : (
        <PackCheckout
          packId={pack.id}
          cents={cents}
          publicKey={publicKey}
          payerEmail={mpPayerEmail(session.user.email)}
          consentText={packConsentSentence(tm, { cents, tokens: pack.tokens, locale })}
        />
      )}

      <p className="ch-muted" style={{ margin: 0 }}>
        <Markup text={t.markup('invoice', { correo: INVOICE_EMAIL, b })} />
      </p>
      <p className="ch-muted" style={{ margin: 0 }}>
        {t('secure')}
      </p>
    </div>
  );
}
