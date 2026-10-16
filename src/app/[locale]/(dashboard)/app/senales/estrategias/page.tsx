import type { Metadata, Route } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ChevronLeft } from 'lucide-react';
import { Link, redirect } from '@/i18n/routing';
import { loadTool } from '@/lib/tools/access';
import { getSenales } from '@/lib/tools/registry';
import { runTool } from '@/lib/tools/bff';
import { DEFAULT_PAIR, parsePair } from '@/lib/tools/senales-market-core';
import { RiskAck } from '@/components/tools/risk-ack';
import { ToolShell } from '@/components/tools/tool-shell';
import { ToolErrorState } from '@/components/tools/tool-error-state';
import { SignalsDisclaimer } from '@/components/tools/senales/common';
import { StrategyLab } from '@/components/tools/senales/strategy-lab';
import '@/styles/tools-senales.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('signalsTool.lab');
  return { title: t('metaTitle') };
}

// Señales · Estrategias: the engine's strategies and its backtest queue
// (parity with the old panel). A backtest runs now, returns its OPTIMISTA
// result and spends credits through the hub's usage admission only when it
// succeeds; refusals are explained on the form.

export default async function SenalesEstrategias({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ par?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const gate = await loadTool(locale, 'chalybcrypto', '/app/senales/estrategias', getSenales);
  if (gate.kind === 'error')
    return (
      <ToolShell slug="chalybcrypto" tab="main">
        <ToolErrorState slug="chalybcrypto" error={gate.error} />
        <SignalsDisclaimer />
      </ToolShell>
    );
  if (gate.kind !== 'ready') return redirect({ href: '/app/senales', locale });
  if (gate.riskPending)
    return (
      <ToolShell slug="chalybcrypto" tab="main">
        <RiskAck slug="chalybcrypto" locale={locale} />
        <SignalsDisclaimer />
      </ToolShell>
    );

  const { session, adapter } = gate;
  const t = await getTranslations('signalsTool.lab');
  const res = await runTool(
    'chalybcrypto',
    session.user.id,
    (signal) =>
      Promise.all([
        adapter.strategies(session.user.id, signal),
        adapter.listBacktests(session.user.id, signal),
      ]),
    { idempotent: true },
  );
  const back = (
    <Link href={'/app/senales' as Route} className="ch-back">
      <ChevronLeft aria-hidden="true" />
      <span>{t('back')}</span>
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
  const { par } = await searchParams;
  return (
    <ToolShell slug="chalybcrypto" tab="main">
      {back}
      <div className="ch-mkt-intro">
        <h2 className="ch-h2">{t('title')}</h2>
        <p className="ch-muted">{t('sub')}</p>
        <Link href={'/app/senales/mercado' as Route} className="ch-lnk">
          {t('toMarket')}
        </Link>
      </div>
      <StrategyLab
        strategies={res.data[0]}
        initialRuns={res.data[1]}
        initialPair={parsePair(par) ?? DEFAULT_PAIR}
        locale={locale}
      />
      <SignalsDisclaimer />
    </ToolShell>
  );
}
