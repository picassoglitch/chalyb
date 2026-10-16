'use client';

// Señales · Estrategias (/app/senales/estrategias): the engine's strategies
// and backtests on past data. A run happens in the engine while the person
// waits (up to ~1 minute) and comes back with its result, always labelled
// OPTIMISTA. It goes through the hub's usage admission inside the engine: a
// refusal shows what the person can do (credits → Uso, busy, plan cap, too
// big); a run that fails is not charged.

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import type { Route } from 'next';
import {
  BACKTEST_BARS,
  BACKTEST_INTERVALS,
  usageRefusalKind,
} from '@/lib/tools/senales-market-core';
import type { BacktestResult, EngineStrategy } from '@/lib/tools/adapters/tools';

type Outcome =
  | { kind: 'done'; run: BacktestResult }
  | { kind: 'usage'; refusal: ReturnType<typeof usageRefusalKind> }
  | { kind: 'bad'; field: 'bars' | 'input' }
  | { kind: 'nodata' }
  | { kind: 'failed'; code?: string; timeout: boolean };

function RunCard({ run, name, locale }: { run: BacktestResult; name: string; locale: string }) {
  const t = useTranslations('signalsTool.lab');
  const loc = locale === 'es' ? 'es-MX' : 'en-US';
  const nf = new Intl.NumberFormat(loc);
  const pct = (bps: number, sign = false) =>
    new Intl.NumberFormat(loc, {
      style: 'percent',
      maximumFractionDigits: 2,
      signDisplay: sign ? 'exceptZero' : 'auto',
    }).format(bps / 10_000);
  const day = (iso?: string) =>
    iso
      ? new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short' }).format(new Date(iso))
      : '';
  const m = run.metrics;
  return (
    <article className="ch-lab-run" aria-label={`${name} ${run.pair}`}>
      <div className="ch-lab-run__h">
        <b>{name}</b>
        <span className="ch-mono">{run.pair}</span>
        <span className="ch-muted">
          {run.timeframe} · {t('barsN', { n: nf.format(run.bars || run.barsRequested) })}
        </span>
        <span className="ch-pill ch-pill--warn">{t('optimistic')}</span>
      </div>
      {run.status === 'failed' ? (
        <p className="ch-muted">{t('runFailed')}</p>
      ) : m ? (
        <>
          <dl className="ch-lab-stats">
            <div>
              <dt>{t('stat.net')}</dt>
              <dd className={(run.netReturnBps ?? 0) >= 0 ? 'ch-lab-up' : 'ch-lab-down'}>
                {pct(run.netReturnBps ?? 0, true)}
              </dd>
            </div>
            <div>
              <dt>{t('stat.trades')}</dt>
              <dd>{nf.format(m.sampleSize)}</dd>
            </div>
            <div>
              <dt>{t('stat.winRate')}</dt>
              <dd>{pct(m.winRate * 10_000)}</dd>
            </div>
            <div>
              <dt>{t('stat.factor')}</dt>
              <dd>{m.profitFactor === null ? '—' : m.profitFactor.toFixed(2)}</dd>
            </div>
            <div>
              <dt>{t('stat.drawdown')}</dt>
              <dd>{pct(m.maxDrawdownBps)}</dd>
            </div>
            <div>
              <dt>{t('stat.fees')}</dt>
              <dd>{pct(m.feeDragBps)}</dd>
            </div>
          </dl>
          <p className="ch-muted ch-mkt-note">
            {t('period', {
              desde: day(run.from),
              hasta: day(run.to),
              fuente: run.dataSource === 'bitunix' ? 'Bitunix' : 'Binance',
            })}
            {run.assumptions
              ? ` ${t('assumptions', {
                  riesgo: pct(run.assumptions.riskPerTradeBps),
                  comision: nf.format(run.assumptions.takerBps),
                })}`
              : ''}
          </p>
        </>
      ) : null}
    </article>
  );
}

export function StrategyLab({
  strategies,
  initialPair,
  initialRuns,
  locale,
}: {
  strategies: EngineStrategy[];
  initialPair: string;
  initialRuns: BacktestResult[];
  locale: string;
}) {
  const t = useTranslations('signalsTool.lab');
  const usable = strategies.filter((s) => s.enabled);
  const [strategy, setStrategy] = useState(usable[0]?.key ?? '');
  const [pair, setPair] = useState(initialPair);
  const [timeframe, setTimeframe] = useState('5m');
  const [bars, setBars] = useState(String(BACKTEST_BARS.default));
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<Outcome | null>(null);
  const [runs, setRuns] = useState<BacktestResult[]>(initialRuns);
  const name = (key: string) => strategies.find((s) => s.key === key)?.name ?? key;

  async function refreshRuns() {
    const r = await fetch('/api/tools/chalybcrypto/backtests', { cache: 'no-store' }).catch(
      () => null,
    );
    const j = (await r?.json().catch(() => null)) as {
      ok: boolean;
      data?: BacktestResult[];
    } | null;
    if (j?.ok && j.data) setRuns(j.data);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = Number(bars);
    if (!Number.isInteger(n) || n < BACKTEST_BARS.min || n > BACKTEST_BARS.max)
      return setOut({ kind: 'bad', field: 'bars' });
    setBusy(true);
    setOut(null);
    try {
      const r = await fetch('/api/tools/chalybcrypto/backtests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy, pair: pair.trim().toUpperCase(), timeframe, bars: n }),
      });
      const j = (await r.json().catch(() => null)) as
        | { ok: true; data: BacktestResult }
        | { ok: false; error?: { reason?: string; usage?: string; supportCode?: string } }
        | null;
      if (j?.ok) {
        setOut({ kind: 'done', run: j.data });
        setRuns((prev) => [j.data, ...prev.filter((x) => x.jobId !== j.data.jobId)].slice(0, 20));
      } else if (j && !j.ok && j.error?.reason === 'usage_refused')
        setOut({ kind: 'usage', refusal: usageRefusalKind(j.error.usage) });
      else if (j && !j.ok && j.error?.reason === 'no_data') {
        setOut({ kind: 'nodata' });
        void refreshRuns();
      } else if (r.status === 400) setOut({ kind: 'bad', field: 'input' });
      else {
        setOut({
          kind: 'failed',
          code: j && !j.ok ? j.error?.supportCode : undefined,
          timeout: r.status === 504,
        });
        // A run that finished after we stopped waiting shows up in the list.
        void refreshRuns();
      }
    } catch {
      setOut({ kind: 'failed', timeout: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ch-lab">
      <section className="ch-card ch-mkt-card" aria-labelledby="lab-list">
        <h2 id="lab-list" className="ch-sig-h3">
          {t('listTitle')}
        </h2>
        {strategies.length ? (
          <ul className="ch-lab-list">
            {strategies.map((s) => (
              <li key={s.key}>
                <span>
                  <b>{s.name}</b>
                  <small className="ch-muted ch-mono">{s.key}</small>
                </span>
                <span className={`ch-pill ${s.enabled ? 'ch-pill--acc' : 'ch-pill--gray'}`}>
                  {s.enabled ? t('on') : t('off')}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ch-muted">{t('none')}</p>
        )}
      </section>

      <section className="ch-card ch-mkt-card" aria-labelledby="lab-bt">
        <div className="ch-mkt-card__h">
          <h2 id="lab-bt" className="ch-sig-h3">
            {t('btTitle')}
          </h2>
          <span className="ch-pill ch-pill--warn">{t('optimistic')}</span>
        </div>
        <p className="ch-muted">{t('btBody')}</p>
        <form className="ch-lab-form" onSubmit={submit}>
          <label className="ch-mkt-field">
            <span>{t('strategy')}</span>
            <select
              className="ch-input"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              required
            >
              {usable.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="ch-mkt-field">
            <span>{t('pair')}</span>
            <input
              className="ch-input ch-mono"
              value={pair}
              onChange={(e) => setPair(e.target.value)}
              maxLength={20}
              pattern="[A-Za-z0-9]{2,20}"
              required
            />
          </label>
          <label className="ch-mkt-field">
            <span>{t('timeframe')}</span>
            <select
              className="ch-input"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
            >
              {BACKTEST_INTERVALS.map((tf) => (
                <option key={tf} value={tf}>
                  {tf}
                </option>
              ))}
            </select>
          </label>
          <label className="ch-mkt-field">
            <span>{t('bars')}</span>
            <input
              className="ch-input"
              type="number"
              inputMode="numeric"
              min={BACKTEST_BARS.min}
              max={BACKTEST_BARS.max}
              step={1}
              value={bars}
              onChange={(e) => setBars(e.target.value)}
              required
            />
          </label>
          <button
            type="submit"
            className="ch-btn ch-btn--primary"
            disabled={busy || !usable.length}
          >
            {busy ? t('running') : t('submit')}
          </button>
        </form>
        <p className="ch-muted ch-mkt-note">{busy ? t('runningNote') : t('usesCredits')}</p>

        {out && out.kind !== 'done' && (
          <div className="ch-lab-out ch-lab-out--bad" role="alert">
            {out.kind === 'usage' && (
              <p>
                {t(`usage.${out.refusal}`)}{' '}
                {out.refusal === 'credits' && (
                  <Link href={'/app/usage' as Route} className="ch-lnk">
                    {t('usageLink')}
                  </Link>
                )}
              </p>
            )}
            {out.kind === 'bad' && <p>{t(`bad.${out.field}`)}</p>}
            {out.kind === 'nodata' && <p>{t('noData')}</p>}
            {out.kind === 'failed' && (
              <p>
                {out.timeout ? t('timeout') : t('failed')}
                {out.code ? ` ${t('code', { codigo: out.code })}` : ''}
              </p>
            )}
          </div>
        )}
        {out?.kind === 'done' && (
          <div role="status" className="ch-lab-latest">
            <h3 className="ch-sig-h3">{t('latest')}</h3>
            <RunCard run={out.run} name={name(out.run.strategy)} locale={locale} />
          </div>
        )}
      </section>

      <section className="ch-card ch-mkt-card ch-lab-hist" aria-labelledby="lab-hist">
        <h2 id="lab-hist" className="ch-sig-h3">
          {t('histTitle')}
        </h2>
        {runs.length ? (
          runs.map((r) => <RunCard key={r.jobId} run={r} name={name(r.strategy)} locale={locale} />)
        ) : (
          <p className="ch-muted">{t('histEmpty')}</p>
        )}
      </section>
    </div>
  );
}
