import type { Metadata, Route } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Info } from 'lucide-react';
import { Link, redirect } from '@/i18n/routing';
import { planKeyFor } from '@/lib/tools/access';
import { requireSenalesReady } from '@/lib/tools/senales-access';
import { signalsFor } from '@/lib/guardrails/signals';
import { latestPerCoin } from '@/lib/tools/signals-view';
import { screenSignal } from '@/lib/tools/signals-screen';
import { WizardShell } from '@/components/ui/wizard-shell';
import { ButtonLink, Pill } from '@/components/ui/primitives';
import { Markup } from '@/components/ui/markup';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('signals');
  return { title: t('metaTitle') };
}

// Señales · listo (SCR-21). The cards render the engine's general state for
// the PLAN, filtered by the user's coins. The disclaimer is fixed on screen.

export default async function SenalesListo({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { session, entitlements, adapter } = await requireSenalesReady(
    locale,
    '/app/senales/empezar/listo',
  );
  const prefs = await adapter.getPrefs(session.user.id);
  if (!prefs) return redirect({ href: '/app/senales/empezar', locale });
  const t = await getTranslations('signals');
  const tw = await getTranslations('wizard');
  const signals = latestPerCoin(
    await signalsFor(adapter, planKeyFor(entitlements.plan), prefs.coins),
  ).map(screenSignal);
  const canal = new Intl.ListFormat(locale === 'es' ? 'es' : 'en', { type: 'disjunction' }).format(
    prefs.channels.map((c) => t(`s2.${c}`)),
  );
  const time = (iso: string) =>
    new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', {
      timeZone: 'America/Mexico_City',
      hour: 'numeric',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
    }).format(new Date(iso));
  const tone = { buy: 'acc', sell: 'warn', wait: 'gray' } as const;

  return (
    <WizardShell
      slug="chalybcrypto"
      toolName="Señales"
      backHref="/app/senales"
      backLabel={tw('back')}
      closeLabel={tw('close')}
    >
      <div style={{ display: 'grid', gap: 22 }}>
        <header>
          <h1 className="ch-h1">{t('done.title')}</h1>
          <p className="ch-sub">{t('done.sub', { canal })}</p>
        </header>
        <div className="ch-disc" role="note">
          <span className="ch-disc__ic" aria-hidden="true">
            <Info />
          </span>
          <p>
            <Markup text={t.markup('disclaimer', { b: (c) => `<b>${c}</b>` })} />{' '}
            <Link href={'/uso-aceptable#avisos' as Route} className="ch-lnk">
              {t('readNotice')}
            </Link>
          </p>
        </div>
        {signals.length === 0 ? (
          <p className="ch-card" style={{ padding: 20 }}>
            {t('done.empty')}
          </p>
        ) : (
          <ul
            className="ch-clips"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
          >
            {signals.map((s) => (
              <li key={s.id} className="ch-card" style={{ padding: 18, display: 'grid', gap: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <b style={{ fontSize: 20 }}>{s.coin}</b>
                  <span className="ch-muted" style={{ fontSize: 15 }}>
                    {time(s.at)}
                  </span>
                </div>
                <Pill kind={tone[s.state]}>{t(`state.${s.state}`)}</Pill>
                <span className="ch-muted" style={{ fontSize: 15 }}>
                  {t(`confidence.${s.confidence}`)}
                </span>
                <details>
                  <summary className="ch-lnk" style={{ cursor: 'pointer' }}>
                    {t('done.why')}
                  </summary>
                  <p style={{ marginTop: 6 }}>{s.explanation}</p>
                </details>
              </li>
            ))}
          </ul>
        )}
        <section className="ch-group" style={{ padding: '6px 0' }} aria-label={t('done.coins')}>
          <div className="ch-row">
            <span className="ch-row__tx">
              <b>{t('done.coins')}</b>
              <small>{prefs.coins.join(', ')}</small>
            </span>
            <ButtonLink href="/app/senales/empezar" variant="secondary" size="compact">
              {t('done.edit')}
            </ButtonLink>
          </div>
          <div className="ch-row">
            <span className="ch-row__tx">
              <b>{t('done.channels')}</b>
              <small>{canal}</small>
            </span>
            <ButtonLink
              href={`/app/senales/empezar/avisos?coins=${prefs.coins.join(',')}`}
              variant="secondary"
              size="compact"
            >
              {t('done.edit')}
            </ButtonLink>
          </div>
        </section>
      </div>
    </WizardShell>
  );
}
