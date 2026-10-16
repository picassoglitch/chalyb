import type { Metadata, Route } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ChevronLeft } from 'lucide-react';
import { Link, redirect } from '@/i18n/routing';
import { loadTool } from '@/lib/tools/access';
import { getSenales } from '@/lib/tools/registry';
import { DEFAULT_PAIR, parsePair } from '@/lib/tools/senales-market-core';
import { RiskAck } from '@/components/tools/risk-ack';
import { ToolShell } from '@/components/tools/tool-shell';
import { ToolErrorState } from '@/components/tools/tool-error-state';
import { SignalsDisclaimer } from '@/components/tools/senales/common';
import { MarketBoard } from '@/components/tools/senales/market-board';
import '@/styles/tools-senales.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('signalsTool.market');
  return { title: t('metaTitle') };
}

// Señales · Mercado: the market part of the engine's old panel, inside the
// app (parity: data source and pair, chart + RSI/MACD/ADX/volume delta,
// order book, derivatives context, news). General data, the same for
// everyone; the legal strip stays on screen.

export default async function SenalesMercado({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ par?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const gate = await loadTool(locale, 'chalybcrypto', '/app/senales/mercado', getSenales);
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

  const t = await getTranslations('signalsTool.market');
  const { par } = await searchParams;
  return (
    <ToolShell slug="chalybcrypto" tab="main">
      <Link href={'/app/senales' as Route} className="ch-back">
        <ChevronLeft aria-hidden="true" />
        <span>{t('back')}</span>
      </Link>
      <div className="ch-mkt-intro">
        <h2 className="ch-h2">{t('title')}</h2>
        <p className="ch-muted">{t('sub')}</p>
        <Link href={'/app/senales/estrategias' as Route} className="ch-lnk">
          {t('toLab')}
        </Link>
      </div>
      <MarketBoard initialPair={parsePair(par) ?? DEFAULT_PAIR} locale={locale} />
      <SignalsDisclaimer />
    </ToolShell>
  );
}
