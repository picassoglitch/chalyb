import type { Metadata, Route } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ChevronLeft, SearchX } from 'lucide-react';
import { Link, redirect } from '@/i18n/routing';
import { loadTool, planKeyFor } from '@/lib/tools/access';
import { getSenales } from '@/lib/tools/registry';
import { runTool } from '@/lib/tools/bff';
import { screenSignal } from '@/lib/tools/signals-screen';
import { formatRefPrice, isOldSignal, SIGNAL_TZ } from '@/lib/tools/signals-view';
import type { SignalRange } from '@/lib/tools/adapters/tools';
import { RiskAck } from '@/components/tools/risk-ack';
import { ToolShell } from '@/components/tools/tool-shell';
import { ToolErrorState } from '@/components/tools/tool-error-state';
import { StateBlock } from '@/components/ui/primitives';
import { SignalsDisclaimer, VerdictPill, whenLabel } from '@/components/tools/senales/common';
import { PriceChart } from '@/components/tools/senales/price-chart';
import { FollowSwitch } from '@/components/tools/senales/follow-switch';
import '@/styles/tools-senales.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('signalsTool');
  return { title: t('metaTitle') };
}

// Detalle de una señal (TOOLS-SPEC §5.3, mockup 55). The chart is the past
// price only. The one action is "Recibir avisos de esta moneda", which only
// changes delivery; the signal is the same for everyone on the plan.

const RANGES: SignalRange[] = ['1d', '7d', '1m'];

export default async function SenalDetalle({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; signalId: string }>;
  searchParams: Promise<{ rango?: string }>;
}) {
  const { locale, signalId } = await params;
  setRequestLocale(locale);
  const path = `/app/senales/${encodeURIComponent(signalId)}`;
  const gate = await loadTool(locale, 'chalybcrypto', path, getSenales);
  if (gate.kind === 'error')
    return (
      <ToolShell slug="chalybcrypto" tab="main">
        <ToolErrorState slug="chalybcrypto" error={gate.error} />
        <SignalsDisclaimer />
      </ToolShell>
    );
  if (gate.kind !== 'ready') return redirect({ href: '/app/senales', locale });
  // The notice opens right here, over the tool (§5.1); no content until accepted.
  if (gate.riskPending)
    return (
      <ToolShell slug="chalybcrypto" tab="main">
        <RiskAck slug="chalybcrypto" locale={locale} />
        <SignalsDisclaimer />
      </ToolShell>
    );

  const { session, entitlements, adapter } = gate;
  const t = await getTranslations('signalsTool');
  const td = await getTranslations('signalsTool.detailPage');
  const { rango } = await searchParams;
  const range: SignalRange = rango === '1d' || rango === '1m' ? rango : '7d';
  const res = await runTool(
    'chalybcrypto',
    session.user.id,
    (signal) =>
      adapter.getSignal({ plan: planKeyFor(entitlements.plan), id: signalId, range }, signal),
    { idempotent: true },
  );
  const back = (
    <Link href={'/app/senales' as Route} className="ch-back">
      <ChevronLeft aria-hidden="true" />
      <span>{td('back')}</span>
    </Link>
  );
  if (!res.ok)
    return (
      <ToolShell slug="chalybcrypto" tab="main">
        {back}
        <ToolErrorState slug="chalybcrypto" error={res.error} />
        <SignalsDisclaimer />
      </ToolShell>
    );
  if (!res.data)
    return (
      <ToolShell slug="chalybcrypto" tab="main">
        {back}
        <StateBlock
          icon={<SearchX />}
          title={td('notFound.title')}
          body={td('notFound.body')}
          action={{ href: '/app/senales', label: td('notFound.cta') }}
        />
        <SignalsDisclaimer />
      </ToolShell>
    );

  const signal = screenSignal(res.data.signal);
  const extra = await runTool(
    'chalybcrypto',
    session.user.id,
    (signal) =>
      Promise.all([
        adapter.coins(signal),
        adapter.getPrefs(session.user.id, signal),
        adapter.channels(signal),
      ]),
    { idempotent: true },
  );
  if (!extra.ok)
    return (
      <ToolShell slug="chalybcrypto" tab="main">
        <ToolErrorState slug="chalybcrypto" error={extra.error} />
        <SignalsDisclaimer />
      </ToolShell>
    );
  const [coins, prefs, channels] = extra.data;
  const name = coins.find((c) => c.symbol === signal.coin)?.name ?? signal.coin;
  const now = new Date().getTime();
  const loc = locale === 'es' ? 'es-MX' : 'en-US';
  const hora = new Intl.DateTimeFormat(loc, {
    timeZone: SIGNAL_TZ,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(signal.at));
  const fechaLarga = new Intl.DateTimeFormat(loc, {
    timeZone: SIGNAL_TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(signal.at));
  const chosen = (prefs?.channels ?? []).filter((c) => channels.includes(c));
  const canales = new Intl.ListFormat(loc, { type: 'conjunction' }).format(
    chosen.map((c) => t(`alerts.${c}`)),
  );
  const tr = (r: SignalRange) => td(`range.${r}`);

  return (
    <ToolShell slug="chalybcrypto" tab="main">
      {back}
      {isOldSignal(signal.at, now) && (
        <p className="ch-sig-old" role="note">
          {td('old', { fecha: fechaLarga })}
        </p>
      )}
      <div className="ch-sig-detail">
        <section className="ch-card ch-sig-chartcard" aria-labelledby="sig-title">
          <div className="ch-sig-detail__head">
            <span className="ch-signal__coin" aria-hidden="true">
              {signal.coin.slice(0, 1)}
            </span>
            <div className="ch-sig-detail__id">
              <h2 id="sig-title" className="ch-h2">
                {name} <span className="ch-signal__sym">{signal.coin}</span>
              </h2>
              <span className="ch-muted">{await whenLabel(signal.at, now, locale)}</span>
            </div>
            {signal.refPriceMXN !== undefined && (
              <span className="ch-signal__ref ch-sig-detail__ref">
                <small>{t('ref')}</small>
                <b>{formatRefPrice(signal.refPriceMXN, locale)}</b>
              </span>
            )}
          </div>
          <div className="ch-sig-detail__bar">
            <VerdictPill state={signal.state} label={t(`verdict.${signal.state}`)} />
            <nav className="ch-sig-range" aria-label={td('rangeAria')}>
              {RANGES.map((r) => (
                <Link
                  key={r}
                  href={`${path}?rango=${r}` as Route}
                  className={r === range ? 'is-on' : undefined}
                  aria-current={r === range ? 'true' : undefined}
                  scroll={false}
                >
                  {tr(r)}
                </Link>
              ))}
            </nav>
          </div>
          <PriceChart
            series={res.data.series}
            signalAt={signal.at}
            range={range}
            locale={locale}
            label={td('chartAria', { moneda: name, periodo: tr(range) })}
            markerLabel={td('marker', { hora })}
          />
        </section>
        <div className="ch-sig-detail__side">
          {signal.why && signal.why.bullets.length > 0 && (
            <section className="ch-card ch-sig-panel" aria-labelledby="sig-why">
              <h2 id="sig-why" className="ch-sig-h3">
                {td('whyTitle')}
              </h2>
              <ol className="ch-sig-why">
                {signal.why.bullets.map((b, i) => (
                  <li key={i}>
                    <span aria-hidden="true">{i + 1}</span>
                    {b}
                  </li>
                ))}
              </ol>
            </section>
          )}
          <FollowSwitch
            coin={signal.coin}
            initial={!!prefs?.coins.includes(signal.coin)}
            coins={prefs?.coins ?? []}
            label={td('follow')}
            via={canales ? td('followVia', { canales }) : ''}
            errorLabel={t('settings.error')}
          />
          <p className="ch-sig-same">{td('same')}</p>
        </div>
      </div>
      <SignalsDisclaimer />
    </ToolShell>
  );
}
