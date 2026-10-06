import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CircleCheck } from 'lucide-react';
import { redirect } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { loadBilling } from '@/lib/billing/subscription-store';
import { PRICING, planPrice } from '@/config/pricing';
import { formatFechaLarga, formatMXN } from '@/lib/billing/format';
import { WizardShell } from '@/components/ui/wizard-shell';
import { ButtonLink } from '@/components/ui/primitives';
import { Markup } from '@/components/ui/markup';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('checkout.done');
  return { title: t('metaTitle') };
}

// SCR-16 · Listo. Everything here is read back from the subscription that
// was just created — the folio IS consent_events.consent_id.

export default async function ListoPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSessionUser();
  if (!session) return redirect({ href: '/sign-in', locale });
  const billing = await loadBilling(session.user.id);
  const row = billing.primaryRow;
  const s = billing.primary;
  if (!row || (s.state !== 'trialing' && s.state !== 'pro'))
    return redirect({ href: '/app/billing', locale });

  const t = await getTranslations('checkout');
  const tPlan = await getTranslations('myplan.planName');
  const planKey = s.planKey ?? 'pro_year';
  const price = planPrice(planKey);
  const monto = formatMXN(price.totalCents);
  const tb = await getTranslations('billing');
  const cada = tb(price.interval === 'year' ? 'vars.cadaPeriodo.year' : 'vars.cadaPeriodo.month');
  const first = ((session.user.user_metadata?.full_name as string | undefined) ?? '')
    .trim()
    .split(/\s+/)[0];
  const trial = s.state === 'trialing';
  const last4 = s.card?.last4 ?? '••••';
  const folio = (row.consent_id as string | null) ?? '';

  return (
    <WizardShell
      slug="chalybclip"
      toolName={t('tool')}
      backHref="/app"
      backLabel={t('back')}
      closeLabel={t('close')}
      narrow
    >
      <div className="ch-center-col">
        <span
          className="ch-state__ic"
          style={{ background: 'var(--ok-tint)', color: 'var(--ok-text)' }}
          aria-hidden="true"
        >
          <CircleCheck />
        </span>
        <h1 className="ch-h1">
          {first ? t('done.title', { nombre: first }) : t('done.titleAnon')}
        </h1>
        <p className="ch-h2">
          {trial
            ? t('done.headline', { dias: PRICING.trial.days, plan: price.tier === 'VIP' ? 'VIP' : 'Pro' })
            : t('done.headlinePaid')}
        </p>
        {trial && s.trialEndsAt && s.nextChargeAt && (
          <p className="ch-sub">
            <Markup
              text={t.markup('done.sub', {
                fecha_fin_prueba: formatFechaLarga(s.trialEndsAt, locale),
                monto,
                fecha_cobro: formatFechaLarga(s.nextChargeAt, locale),
                ultimos4: last4,
                correo: session.user.email ?? '',
                b: (c) => `<b>${c}</b>`,
              })}
            />
          </p>
        )}

        <dl className="ch-card ch-summary" style={{ width: '100%', textAlign: 'left' }}>
          <dt>{t('done.paidToday')}</dt>
          <dd>{trial ? '$0' : `${monto} MXN`}</dd>
          {trial && s.trialEndsAt && (
            <>
              <dt>{t('summary.trialEnds')}</dt>
              <dd>{formatFechaLarga(s.trialEndsAt, locale)}</dd>
            </>
          )}
          {trial && s.nextChargeAt && (
            <>
              <dt>{t('summary.remind')}</dt>
              <dd>
                {formatFechaLarga(
                  new Date(
                    Date.parse(s.nextChargeAt) - PRICING.trial.reminderDaysBefore * 86_400_000,
                  ),
                  locale,
                )}
              </dd>
            </>
          )}
          <dt>
            {t('done.firstCharge', {
              plan: tPlan(planKey),
            })}
          </dt>
          <dd>
            {t('done.card', {
              marca: (s.card?.brand ?? '').toUpperCase(),
              ultimos4: last4,
              cada_periodo: cada,
            })}
          </dd>
        </dl>

        <ButtonLink href="/app/clips" size="xl">
          {t('done.cta')}
        </ButtonLink>
        <ButtonLink href="/app/billing" variant="secondary">
          {t('done.plan')}
        </ButtonLink>
        <p className="ch-muted" style={{ fontSize: 15 }}>
          {t('done.footer', { correo: session.user.email ?? '', folio })}
        </p>
      </div>
    </WizardShell>
  );
}
