// Shared bits of the Señales screens (TOOLS-SPEC §5): the legal strip, the
// verdict pill, the "Hoy, 7:15 a.m." line and the card.

import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Markup } from '@/components/ui/markup';
import { DisclaimerFooter } from '@/components/tools/disclaimer-footer';
import { relativeDay, SIGNAL_TZ, VERDICT, formatRefPrice } from '@/lib/tools/signals-view';
import type { Coin, Signal } from '@/lib/tools/adapters/tools';

export async function SignalsDisclaimer() {
  const t = await getTranslations('toolShell.disclaimer');
  const tc = await getTranslations('consents.risk');
  return (
    <DisclaimerFooter
      text={t.markup('text', { b: (c) => `<b>${c}</b>` })}
      readLabel={t('read')}
      sheetTitle={t('sheetTitle')}
      legal={tc.markup('body', { herramienta: 'Señales', b: (c) => `<b>${c}</b>` })}
      closeLabel={t('close')}
    />
  );
}

export function VerdictPill({ state, label }: { state: Signal['state']; label: string }) {
  return <span className={`ch-pill ch-pill--${VERDICT[state].tone} ch-verdict`}>{label}</span>;
}

export async function whenLabel(at: string, now: number, locale: string): Promise<string> {
  const t = await getTranslations('signalsTool.when');
  const loc = locale === 'es' ? 'es-MX' : 'en-US';
  const hora = new Intl.DateTimeFormat(loc, {
    timeZone: SIGNAL_TZ,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(at));
  const rel = relativeDay(at, now);
  if (rel) return t(rel, { hora });
  const fecha = new Intl.DateTimeFormat(loc, {
    timeZone: SIGNAL_TZ,
    day: 'numeric',
    month: 'short',
  }).format(new Date(at));
  return t('date', { fecha, hora });
}

export async function SignalCard({
  signal,
  coin,
  now,
  locale,
  primary,
  isNew,
}: {
  signal: Signal;
  coin: Coin | undefined;
  now: number;
  locale: string;
  /** The newest card: accent ring and the view's only primary button. */
  primary: boolean;
  isNew: boolean;
}) {
  const t = await getTranslations('signalsTool');
  const name = coin?.name ?? signal.coin;
  const href = `/app/senales/${encodeURIComponent(signal.id)}` as Route;
  return (
    <article
      className={`ch-card ch-signal${primary ? ' ch-signal--top' : ''}`}
      aria-label={`${name} ${signal.coin}`}
    >
      <div className="ch-signal__head">
        <span className="ch-signal__coin" aria-hidden="true">
          {signal.coin.slice(0, 1)}
        </span>
        <b className="ch-signal__name">{name}</b>
        <span className="ch-signal__sym">{signal.coin}</span>
        {isNew && <span className="ch-pill ch-pill--acc ch-signal__new">{t('new')}</span>}
        <span className="ch-signal__when">{await whenLabel(signal.at, now, locale)}</span>
      </div>
      <div className="ch-signal__mid">
        <VerdictPill state={signal.state} label={t(`verdict.${signal.state}`)} />
        {signal.refPriceMXN !== undefined && (
          <span className="ch-signal__ref">
            <small>{t('ref')}</small>
            <b>{formatRefPrice(signal.refPriceMXN, locale)}</b>
          </span>
        )}
      </div>
      <div className="ch-signal__foot">
        {signal.why?.short ? (
          <p className="ch-signal__why">
            <Markup text={t.markup('why', { texto: signal.why.short, b: (c) => `<b>${c}</b>` })} />
          </p>
        ) : (
          <span />
        )}
        {primary ? (
          <Link
            href={href}
            className="ch-btn ch-btn--primary ch-btn--compact"
            aria-label={t('detailAria', { moneda: name })}
          >
            {t('detail')}
          </Link>
        ) : (
          <Link
            href={href}
            className="ch-lnk ch-signal__more"
            aria-label={t('detailAria', { moneda: name })}
          >
            {t('detail')}
            <ChevronRight aria-hidden="true" />
          </Link>
        )}
      </div>
    </article>
  );
}

/** Coin chips: links, so the filter works without JavaScript. They only
 *  filter the list; they never change what a signal says. */
export async function CoinChips({
  base,
  coins,
  active,
}: {
  base: string;
  coins: Coin[];
  active: string | null;
}) {
  const t = await getTranslations('signalsTool.filter');
  return (
    <nav className="ch-coinchips" aria-label={t('aria')}>
      <Link
        href={base as Route}
        className={`ch-chip${active ? '' : ' ch-chip--on'}`}
        aria-current={active ? undefined : 'true'}
      >
        {t('all')}
      </Link>
      {coins.map((c) => (
        <Link
          key={c.symbol}
          href={`${base}?moneda=${c.symbol}` as Route}
          className={`ch-chip${active === c.symbol ? ' ch-chip--on' : ''}`}
          aria-current={active === c.symbol ? 'true' : undefined}
        >
          <span className="ch-coinchips__dot" aria-hidden="true">
            {c.symbol.slice(0, 1)}
          </span>
          {c.name}
        </Link>
      ))}
    </nav>
  );
}
