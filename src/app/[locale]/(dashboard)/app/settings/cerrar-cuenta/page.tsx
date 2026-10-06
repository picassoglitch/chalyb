import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSessionUser } from '@/lib/auth/session';
import { formatFechaLarga } from '@/lib/billing/format';
import { closureSummary } from '@/lib/legal/account-closure';
import { Link } from '@/i18n/routing';
import { ButtonLink } from '@/components/ui/primitives';
import { CloseAccountForm } from '@/components/app/legal/close-account-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('closeAccount');
  return { title: t('metaTitle') };
}

// Mi cuenta → Cerrar mi cuenta (Términos y Condiciones §13.1). Paquetes §5.2:
// before confirming, the unused extra credits and that they are lost; also
// what happens to the plan. An unreadable balance blocks the confirmation
// instead of showing 0.

export default async function CloseAccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('closeAccount');
  const session = await getSessionUser();
  if (!session) return null;
  const { credits, plan, open } = await closureSummary(session.user.id);

  if (open)
    return (
      <div style={{ display: 'grid', gap: 22, maxWidth: 760 }}>
        <h1 className="ch-h1">{t('title')}</h1>
        <p role="status" className="ch-card" style={{ fontWeight: 600 }}>
          {t('open', {
            recibida: formatFechaLarga(open.receivedAt, locale),
            fecha: formatFechaLarga(open.respondBy, locale),
          })}
        </p>
        <ButtonLink href="/app/settings" variant="gray" size="compact">
          {t('back')}
        </ButtonLink>
      </div>
    );

  const planText =
    plan.kind === 'charging'
      ? plan.until
        ? t('plan.charging', { fecha: formatFechaLarga(plan.until, locale) })
        : t('plan.chargingNoDate')
      : plan.kind === 'ending'
        ? t('plan.ending')
        : t('plan.none');

  return (
    <div style={{ display: 'grid', gap: 22, maxWidth: 760 }}>
      <header>
        <h1 className="ch-h1">{t('title')}</h1>
        <p className="ch-sub">{t('sub')}</p>
      </header>
      <section
        className="ch-card"
        aria-labelledby="close-credits"
        style={{ display: 'grid', gap: 6 }}
      >
        <h2 id="close-credits" className="ch-h2">
          {t('credits.title')}
        </h2>
        <p data-testid="close-credits">
          {credits === null
            ? t('credits.unknown')
            : credits > 0
              ? t('credits.some', { n: credits })
              : t('credits.none')}
        </p>
      </section>
      <section className="ch-card" aria-labelledby="close-plan" style={{ display: 'grid', gap: 6 }}>
        <h2 id="close-plan" className="ch-h2">
          {t('plan.title')}
        </h2>
        <p>{planText}</p>
        {plan.kind === 'charging' && (
          <p className="ch-muted">
            {t('onlyStopPaying')}{' '}
            <Link href="/app/billing" className="ch-lnk">
              {t('onlyStopPayingCta')}
            </Link>
          </p>
        )}
      </section>
      <p className="ch-muted">{t('after')}</p>
      <CloseAccountForm creditsShown={credits} />
    </div>
  );
}
