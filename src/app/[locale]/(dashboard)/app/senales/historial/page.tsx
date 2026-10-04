import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { loadTool, planKeyFor } from '@/lib/tools/access';
import { getSenales } from '@/lib/tools/registry';
import { loadSignalFeed } from '@/lib/tools/signals-feed';
import { groupByDay, relativeDay, SIGNAL_TZ } from '@/lib/tools/signals-view';
import { ToolShell } from '@/components/tools/tool-shell';
import { ToolErrorState } from '@/components/tools/tool-error-state';
import { CoinChips, SignalCard, SignalsDisclaimer } from '@/components/tools/senales/common';
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
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ moneda?: string }>;
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
  const prefs = await adapter.getPrefs(session.user.id);
  if (!prefs) return redirect({ href: '/app/senales/empezar', locale });
  const t = await getTranslations('signalsTool');
  const [coins, feed] = await Promise.all([
    adapter.coins(),
    loadSignalFeed(adapter, planKeyFor(entitlements.plan), session.user.id, prefs.coins),
  ]);
  if (!feed.ok)
    return (
      <ToolShell slug="chalybcrypto" tab="history">
        <ToolErrorState slug="chalybcrypto" error={feed.error} />
        <SignalsDisclaimer />
      </ToolShell>
    );
  const { moneda } = await searchParams;
  const active = moneda && prefs.coins.includes(moneda) ? moneda : null;
  const now = new Date().getTime();
  const days = groupByDay(feed.signals.filter((s) => !active || s.coin === active));
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
  return (
    <ToolShell slug="chalybcrypto" tab="history">
      <CoinChips
        base="/app/senales/historial"
        coins={coins.filter((c) => prefs.coins.includes(c.symbol))}
        active={active}
      />
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
      <SignalsDisclaimer />
    </ToolShell>
  );
}
