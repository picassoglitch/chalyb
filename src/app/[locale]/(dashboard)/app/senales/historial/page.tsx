import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { loadTool, planKeyFor } from '@/lib/tools/access';
import { getSenales } from '@/lib/tools/registry';
import { loadSenalesPrefs } from '@/lib/tools/senales-access';
import { loadSignalFeed } from '@/lib/tools/signals-feed';
import { groupByDay, relativeDay, SIGNAL_TZ } from '@/lib/tools/signals-view';
import { ToolShell } from '@/components/tools/tool-shell';
import { ToolErrorState } from '@/components/tools/tool-error-state';
import { SignalCard, SignalsDisclaimer } from '@/components/tools/senales/common';
import { CoinChipsLive, CoinVariant } from '@/components/tools/senales/coin-filter';
import '@/styles/tools-senales.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('signalsTool');
  return { title: t('metaHistory') };
}

// Historial de Señales (TOOLS-SPEC §2, §5.2): the same card, grouped by
// day, with coin chips. Locked, setup and the risk notice are handled on
// /app/senales.

export default async function SenalesHistorial({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const gate = await loadTool(locale, 'chalybcrypto', '/app/senales/historial', getSenales);
  if (gate.kind === 'error')
    return (
      <ToolShell slug="chalybcrypto" tab="history">
        <ToolErrorState slug="chalybcrypto" error={gate.error} />
        <SignalsDisclaimer />
      </ToolShell>
    );
  if (gate.kind !== 'ready' || gate.riskPending) return redirect({ href: '/app/senales', locale });
  const { session, entitlements, adapter } = gate;
  // The feed is content by plan (no user input): it starts with the prefs
  // read, not after it; only its coin filter waits for the prefs.
  const prefsAsync = loadSenalesPrefs(adapter, session.user.id);
  const feedAsync = loadSignalFeed(
    adapter,
    planKeyFor(entitlements.plan),
    session.user.id,
    prefsAsync.then((r) => (r.ok && r.data ? r.data.coins : [])),
  );
  const prefsRes = await prefsAsync;
  if (!prefsRes.ok)
    return (
      <ToolShell slug="chalybcrypto" tab="history">
        <ToolErrorState slug="chalybcrypto" error={prefsRes.error} />
        <SignalsDisclaimer />
      </ToolShell>
    );
  const prefs = prefsRes.data;
  if (!prefs) return redirect({ href: '/app/senales/empezar', locale });
  const t = await getTranslations('signalsTool');
  const [coins, feed] = await Promise.all([adapter.coins(), feedAsync]);
  if (!feed.ok)
    return (
      <ToolShell slug="chalybcrypto" tab="history">
        <ToolErrorState slug="chalybcrypto" error={feed.error} />
        <SignalsDisclaimer />
      </ToolShell>
    );
  const mine = coins.filter((c) => prefs.coins.includes(c.symbol));
  const now = new Date().getTime();
  const loc = locale === 'es' ? 'es-MX' : 'en-US';
  const dayTitle = (iso: string) => {
    const rel = relativeDay(iso, now);
    if (rel) return t(`history.${rel}`);
    return new Intl.DateTimeFormat(loc, {
      timeZone: SIGNAL_TZ,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date(iso));
  };
  // One version per chip value (CoinVariant picks it in the browser).
  const screenFor = (active: string | null) => {
    const days = groupByDay(feed.signals.filter((s) => !active || s.coin === active));
    return (
      <>
        {days.length === 0 ? (
          <div className="ch-card ch-state ch-sig-empty">
            <p>{t('history.empty')}</p>
          </div>
        ) : (
          days.map((d) => (
            <section key={d.day} className="ch-sig-day" aria-labelledby={`day-${d.day}`}>
              <h2 id={`day-${d.day}`} className="ch-ghead">
                {dayTitle(d.items[0]!.at)}
              </h2>
              <div className="ch-sig-list">
                {d.items.map((s) => (
                  <SignalCard
                    key={s.id}
                    signal={s}
                    coin={coins.find((c) => c.symbol === s.coin)}
                    now={now}
                    locale={locale}
                    primary={false}
                    isNew={false}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </>
    );
  };

  return (
    <ToolShell slug="chalybcrypto" tab="history">
      <CoinChipsLive
        base="/app/senales/historial"
        coins={mine.map((c) => ({ symbol: c.symbol, name: c.name }))}
      />
      <CoinVariant
        variants={Object.fromEntries([
          ['', screenFor(null)],
          ...mine.map((c) => [c.symbol, screenFor(c.symbol)]),
        ])}
      />
      <SignalsDisclaimer />
    </ToolShell>
  );
}
