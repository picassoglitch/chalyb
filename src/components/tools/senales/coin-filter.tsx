'use client';
// Señales' coin chips (Inicio, Historial), applied in the browser. The
// server renders the screen once per chip value (all coins, then each of the
// person's coins) from the feed it already read; a chip only changes the URL
// (?moneda=…, the same links as before, so reloads, shared links and the back
// button keep working) and shows that version at once, instead of asking the
// engine for the plan's feed again. Without JavaScript the chips are plain
// links and the server renders the picked one.

import type { Route } from 'next';
import type { MouseEvent, ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { isPlainClick } from '@/components/ui/optimistic-nav';

/** The picked coin: ?moneda= when it's one of `allowed`, else '' (all). */
function useActiveCoin(allowed: readonly string[]): string {
  const moneda = useSearchParams().get('moneda');
  return moneda && allowed.includes(moneda) ? moneda : '';
}

const searchFor = (coin: string) => (coin ? `?moneda=${encodeURIComponent(coin)}` : '');

export function CoinChipsLive({
  base,
  coins,
}: {
  base: string;
  coins: { symbol: string; name: string }[];
}) {
  const t = useTranslations('signalsTool.filter');
  const active = useActiveCoin(coins.map((c) => c.symbol));
  const onPick = (coin: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    // Same path (with its locale prefix, if any), new query. Next's router
    // syncs useSearchParams with pushState: no request.
    window.history.pushState(null, '', `${window.location.pathname}${searchFor(coin)}`);
  };
  return (
    <nav className="ch-coinchips" aria-label={t('aria')}>
      <Link
        href={base as Route}
        className={`ch-chip${active ? '' : ' ch-chip--on'}`}
        aria-current={active ? undefined : 'true'}
        onClick={onPick('')}
      >
        {t('all')}
      </Link>
      {coins.map((c) => (
        <Link
          key={c.symbol}
          href={`${base}${searchFor(c.symbol)}` as Route}
          className={`ch-chip${active === c.symbol ? ' ch-chip--on' : ''}`}
          aria-current={active === c.symbol ? 'true' : undefined}
          onClick={onPick(c.symbol)}
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

/** The server-rendered version for the picked coin ('' = all coins). */
export function CoinVariant({ variants }: { variants: Record<string, ReactNode> }) {
  const active = useActiveCoin(Object.keys(variants).filter(Boolean));
  return <>{variants[active] ?? variants['']}</>;
}
