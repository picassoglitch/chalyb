'use client';

// Señales · Mercado (/app/senales/mercado): everything the engine's old
// panel showed about the market, inside the app — the data source and pair
// picker, the price chart with RSI/MACD/ADX/volume delta, the live order
// book (every 2 s), the derivatives context and the coin's news. All of it
// is the same for everyone; nothing here reads or places anything for the
// person. Every call goes through the BFF (/api/tools/chalybcrypto/*).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { RefreshCw } from 'lucide-react';
import {
  CHART_INTERVALS,
  QUICK_PAIRS,
  baseOf,
  bookTop,
  depthWidths,
  formatCompact,
  formatPrice,
  parsePair,
  type ChartInterval,
} from '@/lib/tools/senales-market-core';
import type {
  DerivativesContext,
  MarketIndicators,
  MarketList,
  MarketVenueId,
  NewsItem,
  OrderBook,
} from '@/lib/tools/adapters/tools';
import { MarketCharts, PairBars, Spark } from './market-charts';

type Res<T> = { ok: true; data: T } | { ok: false; status: number; code?: string };

async function getJson<T>(url: string, signal?: AbortSignal): Promise<Res<T>> {
  try {
    const r = await fetch(url, { signal, cache: 'no-store' });
    const j = (await r.json().catch(() => null)) as
      | { ok: true; data: T }
      | { ok: false; error?: { supportCode?: string } }
      | null;
    if (r.ok && j && j.ok) return { ok: true, data: j.data };
    return { ok: false, status: r.status, code: j && !j.ok ? j.error?.supportCode : undefined };
  } catch {
    return { ok: false, status: 0 };
  }
}

const API = '/api/tools/chalybcrypto';
const BOOK_EVERY_MS = 2000;

/** Load `url` (and poll it every `every` ms while the page is visible).
 *  Data belongs to the url it came from, so a new pair never shows the old
 *  pair's numbers; a failed poll keeps the last good data. */
function useLoad<T>(url: string, every?: number) {
  const [state, setState] = useState<{ url: string; res: Res<T> | null; at: number | null }>({
    url: '',
    res: null,
    at: null,
  });
  const seq = useRef(0);
  const run = useCallback(async () => {
    const id = ++seq.current;
    const res = await getJson<T>(url);
    if (id !== seq.current) return;
    setState((s) => {
      const same = s.url === url;
      const keep = !res.ok && same && s.res?.ok;
      return { url, res: keep ? s.res : res, at: res.ok ? Date.now() : same ? s.at : null };
    });
  }, [url]);
  useEffect(() => {
    const first = setTimeout(() => void run(), 0);
    const h = every
      ? setInterval(() => {
          if (document.visibilityState === 'visible') void run();
        }, every)
      : undefined;
    return () => {
      clearTimeout(first);
      if (h) clearInterval(h);
      seq.current += 1;
    };
  }, [run, every]);
  const current = state.url === url;
  return { res: current ? state.res : null, at: current ? state.at : null, reload: run };
}

function ErrorLine({
  res,
  onRetry,
  t,
}: {
  res: Res<unknown> | null;
  onRetry: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="ch-mkt-err" role="status">
      <p>
        {res && !res.ok && res.status === 400 ? t('badPair') : t('error')}
        {res && !res.ok && res.code ? ` ${t('code', { codigo: res.code })}` : ''}
      </p>
      <button type="button" className="ch-btn ch-btn--gray ch-btn--compact" onClick={onRetry}>
        {t('retry')}
      </button>
    </div>
  );
}

export function MarketBoard({ initialPair, locale }: { initialPair: string; locale: string }) {
  const t = useTranslations('signalsTool.market');
  const loc = locale === 'es' ? 'es-MX' : 'en-US';
  const [venue, setVenue] = useState<MarketVenueId>('bitunix');
  const [pair, setPair] = useState(initialPair);
  const [interval, setIntervalTf] = useState<ChartInterval>('5m');
  const [search, setSearch] = useState('');
  const coin = baseOf(pair);

  // Keep ?par= in the address so the view can be shared and reloaded.
  useEffect(() => {
    const u = new URL(window.location.href);
    u.searchParams.set('par', pair);
    window.history.replaceState(null, '', u);
  }, [pair]);

  const markets = useLoad<MarketList>(`${API}/markets?venue=${venue}`);
  const chart = useLoad<MarketIndicators>(
    `${API}/indicators/${encodeURIComponent(pair)}?interval=${interval}`,
  );
  const book = useLoad<OrderBook>(`${API}/orderbook/${encodeURIComponent(pair)}`, BOOK_EVERY_MS);
  const deriv = useLoad<DerivativesContext | null>(
    `${API}/derivatives/${encodeURIComponent(pair)}?interval=1h`,
  );
  const news = useLoad<NewsItem[] | null>(`${API}/news?coin=${encodeURIComponent(coin)}`);

  const list = markets.res?.ok ? markets.res.data : null;
  const symbols = useMemo(() => list?.symbols ?? [], [list]);
  const matches = useMemo(() => {
    const f = search.trim().toUpperCase();
    return f ? symbols.filter((s) => s.symbol.includes(f) || s.base.includes(f)) : symbols;
  }, [symbols, search]);
  // The select lists at most 400; the count says how many match.
  const filtered = useMemo(() => matches.slice(0, 400), [matches]);
  const avail = new Set(symbols.map((s) => s.symbol));
  const quick = QUICK_PAIRS.filter((q) => !avail.size || avail.has(q));
  const activeVenue = list?.venues.find((v) => v.id === venue);
  const hora = (ms: number | null) =>
    ms
      ? new Intl.DateTimeFormat(loc, {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
        }).format(ms)
      : '';

  const choose = (p: string) => {
    const ok = parsePair(p);
    if (ok) setPair(ok);
  };

  const failed = (r: { res: Res<unknown> | null }) => r.res !== null && !r.res.ok;
  // ── order book ────────────────────────────────────────────────────────
  const ob = book.res?.ok ? book.res.data : null;
  const bids = ob?.bids.slice(0, 15) ?? [];
  const asks = ob?.asks.slice(0, 15) ?? [];
  const widths = depthWidths(bids, asks);
  const top = ob ? bookTop(ob) : null;

  // ── derivatives ───────────────────────────────────────────────────────
  const d = deriv.res?.ok ? deriv.res.data : undefined;
  const lastOf = <T,>(a: T[]) => a.at(-1);
  const liq24 = d
    ? d.liquidations
        .slice(-24)
        .reduce((a, r) => ({ l: a.l + r.longUsd, s: a.s + r.shortUsd }), { l: 0, s: 0 })
    : null;
  const ratio = d ? lastOf(d.longShort) : undefined;
  // The engine's funding is a fraction (0.0001 = 0.01 %), as the old panel showed it.
  const pct = (v: number) =>
    new Intl.NumberFormat(loc, {
      style: 'percent',
      maximumFractionDigits: 4,
      signDisplay: 'exceptZero',
    }).format(v);

  const n = news.res?.ok ? news.res.data : undefined;
  const rel = new Intl.RelativeTimeFormat(loc, { numeric: 'auto' });
  const newsAt = news.at;
  const ago = (iso: string) => {
    if (!newsAt) return '';
    const min = Math.round((Date.parse(iso) - newsAt) / 60_000);
    if (!Number.isFinite(min)) return '';
    if (Math.abs(min) < 60) return rel.format(min, 'minute');
    if (Math.abs(min) < 1440) return rel.format(Math.round(min / 60), 'hour');
    return rel.format(Math.round(min / 1440), 'day');
  };

  return (
    <div className="ch-mkt">
      {/* Picker */}
      <section className="ch-card ch-mkt-pick" aria-labelledby="mkt-pick">
        <h2 id="mkt-pick" className="ch-sig-h3">
          {t('pickTitle')}
        </h2>
        <div className="ch-mkt-pick__row">
          <label className="ch-mkt-field">
            <span>{t('source')}</span>
            <select
              className="ch-input"
              value={venue}
              onChange={(e) => setVenue(e.target.value as MarketVenueId)}
            >
              {(list?.venues ?? [{ id: 'bitunix', name: 'Bitunix', dataOnly: false }]).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <small className="ch-muted">{t(`venue.${venue}`)}</small>
          </label>
          <label className="ch-mkt-field">
            <span>{t('search')}</span>
            <input
              className="ch-input"
              value={search}
              placeholder={t('searchPlaceholder')}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  choose(filtered[0]?.symbol ?? search);
                }
              }}
            />
            <small className="ch-muted">
              {symbols.length ? t('count', { n: matches.length }) : t('noList')}
            </small>
          </label>
          <label className="ch-mkt-field">
            <span>{t('pair')}</span>
            <select
              className="ch-input ch-mono"
              value={pair}
              onChange={(e) => choose(e.target.value)}
            >
              {!filtered.some((s) => s.symbol === pair) && <option value={pair}>{pair}</option>}
              {filtered.map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol}
                </option>
              ))}
            </select>
          </label>
          <div className="ch-mkt-active" aria-live="polite">
            <small className="ch-muted">{t('watching')}</small>
            <b className="ch-mono">{pair}</b>
            <small className="ch-muted">{activeVenue?.name ?? 'Bitunix'}</small>
          </div>
        </div>
        <div className="ch-mkt-quick" role="group" aria-label={t('quick')}>
          {quick.map((q) => (
            <button
              key={q}
              type="button"
              className={`ch-chip${q === pair ? ' ch-chip--on' : ''}`}
              aria-pressed={q === pair}
              onClick={() => choose(q)}
            >
              {q.replace(/USDT$/, '')}
            </button>
          ))}
        </div>
        {venue !== 'bitunix' && <p className="ch-muted ch-mkt-note">{t('chartSource')}</p>}
        {failed(markets) && <ErrorLine t={t} res={markets.res} onRetry={markets.reload} />}
      </section>

      {/* Chart */}
      <section className="ch-card ch-mkt-card" aria-labelledby="mkt-chart">
        <div className="ch-mkt-card__h">
          <h2 id="mkt-chart" className="ch-sig-h3">
            {t('chartTitle', { par: pair })}
          </h2>
          <div className="ch-mkt-tf" role="group" aria-label={t('timeframe')}>
            {CHART_INTERVALS.map((tf) => (
              <button
                key={tf}
                type="button"
                className={`ch-chip ch-chip--sm${tf === interval ? ' ch-chip--on' : ''}`}
                aria-pressed={tf === interval}
                onClick={() => setIntervalTf(tf)}
              >
                {t(`tf.${tf}`)}
              </button>
            ))}
            <button
              type="button"
              className="ch-btn ch-btn--gray ch-btn--compact ch-mkt-refresh"
              onClick={chart.reload}
              aria-label={t('refresh')}
              title={t('refresh')}
            >
              <RefreshCw aria-hidden="true" />
            </button>
          </div>
        </div>
        {chart.res?.ok && chart.res.data.candles.length ? (
          <MarketCharts
            data={chart.res.data}
            locale={locale}
            labels={{
              price: t('price'),
              rsi: t('rsi'),
              rsiHelp: t('rsiHelp'),
              macd: t('macd'),
              macdHelp: t('macdHelp'),
              adx: t('adx'),
              adxHelp: t('adxHelp'),
              vd: t('vd'),
              vdHelp: t('vdHelp'),
              open: t('open'),
              high: t('high'),
              low: t('low'),
              close: t('close'),
            }}
          />
        ) : failed(chart) ? (
          <ErrorLine t={t} res={chart.res} onRetry={chart.reload} />
        ) : chart.res?.ok ? (
          <p className="ch-muted">{t('noCandles')}</p>
        ) : (
          <div className="ch-mkt-skel" aria-label={t('loading')} />
        )}
        <p className="ch-muted ch-mkt-note">
          {chart.at ? t('updated', { hora: hora(chart.at) }) : t('loading')}
        </p>
      </section>

      <div className="ch-mkt-grid2">
        {/* Order book */}
        <section className="ch-card ch-mkt-card" aria-labelledby="mkt-book">
          <div className="ch-mkt-card__h">
            <h2 id="mkt-book" className="ch-sig-h3">
              {t('bookTitle')}
            </h2>
            {top && (
              <span className="ch-muted ch-mkt-mid">
                {t('mid', { precio: formatPrice(top.mid, locale) })} ·{' '}
                {t('spread', { pb: top.spreadBps.toFixed(2) })}
              </span>
            )}
          </div>
          {ob ? (
            <div className="ch-mkt-book">
              {(['bids', 'asks'] as const).map((side) => (
                <div key={side} className={`ch-mkt-book__side ch-mkt-book__side--${side}`}>
                  <div className="ch-mkt-book__row ch-mkt-book__head">
                    <span>{t(side)}</span>
                    <span>{t('size')}</span>
                    <span>{t('total')}</span>
                  </div>
                  {(side === 'bids' ? bids : asks).map((l, i) => (
                    <div key={`${l.price}-${i}`} className="ch-mkt-book__row">
                      <i
                        className="ch-mkt-book__depth"
                        style={{
                          width: `${(side === 'bids' ? widths.bids : widths.asks)[i]!.toFixed(1)}%`,
                        }}
                        aria-hidden="true"
                      />
                      <span className="ch-mkt-book__px">{formatPrice(l.price, locale)}</span>
                      <span>{formatCompact(l.size, locale)}</span>
                      <span className="ch-muted">{formatCompact(l.cumulative, locale)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : failed(book) ? (
            <ErrorLine t={t} res={book.res} onRetry={book.reload} />
          ) : (
            <div className="ch-mkt-skel ch-mkt-skel--sm" aria-label={t('loading')} />
          )}
          <p className="ch-muted ch-mkt-note">
            {book.at ? t('bookLive', { hora: hora(book.at) }) : t('loading')}
            {failed(book) && ob ? ` · ${t('stale')}` : ''}
          </p>
        </section>

        {/* News */}
        <section className="ch-card ch-mkt-card" aria-labelledby="mkt-news">
          <h2 id="mkt-news" className="ch-sig-h3">
            {t('newsTitle', { moneda: coin })}
          </h2>
          {n === null ? (
            <p className="ch-muted">{t('newsOff')}</p>
          ) : n ? (
            n.length ? (
              <ul className="ch-mkt-news">
                {n.map((i) => (
                  <li key={i.url}>
                    <a href={i.url} rel="noopener noreferrer nofollow" className="ch-lnk">
                      {i.title}
                    </a>
                    <small className="ch-muted">
                      {i.source} · {ago(i.publishedAt)}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ch-muted">{t('newsEmpty')}</p>
            )
          ) : failed(news) ? (
            <ErrorLine t={t} res={news.res} onRetry={news.reload} />
          ) : (
            <div className="ch-mkt-skel ch-mkt-skel--sm" aria-label={t('loading')} />
          )}
          <p className="ch-muted ch-mkt-note">{t('newsNote')}</p>
        </section>
      </div>

      {/* Derivatives */}
      <section className="ch-card ch-mkt-card" aria-labelledby="mkt-deriv">
        <div className="ch-mkt-card__h">
          <h2 id="mkt-deriv" className="ch-sig-h3">
            {t('derivTitle', { moneda: coin })}
          </h2>
          <span className="ch-muted ch-mkt-mid">{t('derivNote')}</span>
        </div>
        {d === null ? (
          <p className="ch-muted">{t('derivOff')}</p>
        ) : d ? (
          <div className="ch-mkt-deriv">
            <div className="ch-mkt-stat">
              <small className="ch-muted">{t('oi')}</small>
              <b>
                {lastOf(d.openInterest)
                  ? `$${formatCompact(lastOf(d.openInterest)!.value, locale)}`
                  : '—'}
              </b>
              <Spark points={d.openInterest} label={t('oi')} />
            </div>
            <div className="ch-mkt-stat">
              <small className="ch-muted">{t('funding')}</small>
              <b>{lastOf(d.funding) ? pct(lastOf(d.funding)!.value) : '—'}</b>
              <Spark points={d.funding} label={t('funding')} zero />
            </div>
            <div className="ch-mkt-stat">
              <small className="ch-muted">{t('liq')}</small>
              <b>
                {liq24
                  ? t('liqValue', {
                      largos: `$${formatCompact(liq24.l, locale)}`,
                      cortos: `$${formatCompact(liq24.s, locale)}`,
                    })
                  : '—'}
              </b>
              <PairBars
                rows={d.liquidations.map((r) => ({
                  time: r.time,
                  up: r.longUsd,
                  down: r.shortUsd,
                }))}
                label={t('liq')}
              />
            </div>
            <div className="ch-mkt-stat">
              <small className="ch-muted">{t('ratio')}</small>
              {ratio ? (
                <>
                  <b>
                    {t('ratioValue', {
                      largos: ratio.longPct.toFixed(1),
                      cortos: ratio.shortPct.toFixed(1),
                    })}
                  </b>
                  <div className="ch-mkt-ratio" aria-hidden="true">
                    <i style={{ width: `${Math.max(0, Math.min(100, ratio.longPct))}%` }} />
                  </div>
                </>
              ) : (
                <b>{t('notInPlan')}</b>
              )}
            </div>
            <div className="ch-mkt-stat ch-mkt-stat--wide">
              <small className="ch-muted">{t('heat')}</small>
              {d.heatmap.length ? (
                <ul className="ch-mkt-heat">
                  {[...d.heatmap]
                    .sort((a, b) => b.amountUsd - a.amountUsd)
                    .slice(0, 8)
                    .map((h) => (
                      <li key={h.price}>
                        <span className="ch-mono">{formatPrice(h.price, locale)}</span>
                        <i
                          style={{
                            width: `${(h.amountUsd / Math.max(...d.heatmap.map((x) => x.amountUsd), 1)) * 100}%`,
                          }}
                          aria-hidden="true"
                        />
                        <small className="ch-muted">${formatCompact(h.amountUsd, locale)}</small>
                      </li>
                    ))}
                </ul>
              ) : (
                <b>{t('notInPlan')}</b>
              )}
            </div>
          </div>
        ) : failed(deriv) ? (
          <ErrorLine t={t} res={deriv.res} onRetry={deriv.reload} />
        ) : (
          <div className="ch-mkt-skel ch-mkt-skel--sm" aria-label={t('loading')} />
        )}
      </section>
    </div>
  );
}
