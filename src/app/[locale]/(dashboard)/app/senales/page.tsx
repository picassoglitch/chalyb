import type { Metadata, Route } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect, Link } from '@/i18n/routing';
import { loadTool, planKeyFor } from '@/lib/tools/access';
import { getSenales } from '@/lib/tools/registry';
import { loadSignalFeed } from '@/lib/tools/signals-feed';
import { isNewSignal, latestPerCoin } from '@/lib/tools/signals-view';
import { ToolShell } from '@/components/tools/tool-shell';
import { ToolErrorState } from '@/components/tools/tool-error-state';
import { ToolLockedState, lockedOffer } from '@/components/tools/tool-locked-state';
import { RiskAck } from '@/components/tools/risk-ack';
import { SetupState } from '@/components/ui/setup-state';
import { Skeleton } from '@/components/ui/primitives';
import {
  CoinChips,
  SignalCard,
  SignalsDisclaimer,
  VerdictPill,
} from '@/components/tools/senales/common';
import '@/styles/tools-senales.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('signalsTool');
  return { title: t('metaTitle') };
}

// Inicio de Señales (TOOLS-SPEC §5.2, mockup 54). The risk notice (53)
// opens over it until accepted (F2); with no coins chosen yet, the first
// activation. Cards are the plan's signals, filtered by the person's coins
// and the chip; the legal strip is always on screen.

export default async function SenalesHome({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ moneda?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const gate = await loadTool(locale, 'chalybcrypto', '/app/senales', getSenales);

  if (gate.kind === 'locked')
    return (
      <ToolShell
        slug="chalybcrypto"
        tab={null}
        plan={lockedOffer(gate.entitlements).trial ? 'offer' : 'pro'}
      >
        <ToolLockedState slug="chalybcrypto" entitlements={gate.entitlements} />
      </ToolShell>
    );
  if (gate.kind === 'error')
    return (
      <ToolShell slug="chalybcrypto" tab="main">
        <ToolErrorState slug="chalybcrypto" error={gate.error} />
      </ToolShell>
    );
  if (gate.kind === 'setup')
    return (
      <ToolShell slug="chalybcrypto" tab="main">
        <SetupState step={gate.step} />
      </ToolShell>
    );

  // 'risk': the engine runs in its own app (mode off) and the notice is still
  // pending; accepting it refreshes this page into the SSO hand-off.
  if (gate.kind === 'risk' || gate.riskPending)
    return (
      <ToolShell slug="chalybcrypto" tab="main">
        <div className="ch-sig-skel" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={150} />
          ))}
        </div>
        <SignalsDisclaimer />
        <RiskAck slug="chalybcrypto" locale={locale} />
      </ToolShell>
    );

  const { session, entitlements, adapter } = gate;
  const prefs = await adapter.getPrefs(session.user.id);
  if (!prefs) return redirect({ href: '/app/senales/empezar', locale });

  const t = await getTranslations('signalsTool');
  const [coins, feed] = await Promise.all([
    adapter.coins(),
    loadSignalFeed(adapter, planKeyFor(entitlements.plan), session.user.id, prefs.coins),
  ]);
  if (!feed.ok)
    return (
      <ToolShell slug="chalybcrypto" tab="main">
        <ToolErrorState slug="chalybcrypto" error={feed.error} />
        <SignalsDisclaimer />
      </ToolShell>
    );

  const { moneda } = await searchParams;
  const active = moneda && prefs.coins.includes(moneda) ? moneda : null;
  const mine = coins.filter((c) => prefs.coins.includes(c.symbol));
  const list = latestPerCoin(feed.signals).filter((s) => !active || s.coin === active);
  const now = new Date().getTime();
  const hour = (hhmm: string) =>
    new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
    }).format(new Date(`1970-01-01T${hhmm}:00Z`));
  const channels = await adapter.channels();

  return (
    <ToolShell slug="chalybcrypto" tab="main">
      <CoinChips base="/app/senales" coins={mine} active={active} />
      {feed.stale && (
        <div className="ch-sig-partial" role="status">
          <p>{t('partial')}</p>
          <Link href={'/app/senales' as Route} className="ch-btn ch-btn--gray ch-btn--compact">
            {t('retry')}
          </Link>
        </div>
      )}
      <div className="ch-sig-layout">
        <section aria-labelledby="sig-list" className="ch-sig-list">
          <h2 id="sig-list" className="ch-sr">
            {t('listTitle')}
          </h2>
          {list.length === 0 ? (
            <div className="ch-card ch-state ch-sig-empty">
              <p>{t('empty')}</p>
              <Link href={'/app/senales/ajustes' as Route} className="ch-lnk">
                {t('emptyAdd')}
              </Link>
            </div>
          ) : (
            list.map((s, i) => (
              <SignalCard
                key={s.id}
                signal={s}
                coin={coins.find((c) => c.symbol === s.coin)}
                now={now}
                locale={locale}
                primary={i === 0}
                isNew={i === 0 && isNewSignal(s.at, now)}
              />
            ))
          )}
        </section>
        <aside className="ch-sig-side">
          <section className="ch-card ch-sig-panel" aria-labelledby="sig-alerts">
            <div className="ch-sig-panel__h">
              <h2 id="sig-alerts" className="ch-sig-h3">
                {t('alerts.title')}
              </h2>
              <Link href={'/app/senales/ajustes' as Route} className="ch-lnk">
                {t('alerts.change')}
              </Link>
            </div>
            <ul className="ch-sig-alerts">
              {channels.map((c) => (
                <li key={c}>
                  <span>{t(`alerts.${c}`)}</span>
                  <b className={prefs.channels.includes(c) ? 'ch-sig-yes' : 'ch-muted'}>
                    {prefs.channels.includes(c) ? t('alerts.yes') : t('alerts.no')}
                  </b>
                </li>
              ))}
              <li>
                <span>{t('alerts.schedule')}</span>
                <b>
                  {prefs.quietHours
                    ? t('alerts.range', {
                        desde: hour(prefs.from ?? '08:00'),
                        hasta: hour(prefs.to ?? '22:00'),
                      })
                    : t('alerts.allDay')}
                </b>
              </li>
            </ul>
          </section>
          <section className="ch-card ch-sig-panel" aria-labelledby="sig-legend">
            <h2 id="sig-legend" className="ch-sig-h3">
              {t('legend.title')}
            </h2>
            <dl className="ch-sig-legend">
              {(['buy', 'sell', 'wait'] as const).map((k) => (
                <div key={k}>
                  <dt>
                    <VerdictPill state={k} label={t(`verdict.${k}`)} />
                  </dt>
                  <dd className="ch-muted">{t(`legend.${k}`)}</dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </div>
      <SignalsDisclaimer />
    </ToolShell>
  );
}
