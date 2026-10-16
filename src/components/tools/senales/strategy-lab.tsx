'use client';

// Señales · Estrategias (/app/senales/estrategias): the engine's strategies
// and its backtest queue, like the old panel. A backtest goes through the
// hub's usage admission inside the engine; a refusal shows what the person
// can do (credits → Uso, busy, plan cap, too big). Results are always
// labelled OPTIMISTA (engine rule).

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import type { Route } from 'next';
import {
  BACKTEST_BARS,
  BACKTEST_INTERVALS,
  usageRefusalKind,
} from '@/lib/tools/senales-market-core';
import type { BacktestQueued, EngineStrategy } from '@/lib/tools/adapters/tools';

type Outcome =
  | { kind: 'queued'; job: BacktestQueued }
  | { kind: 'usage'; refusal: ReturnType<typeof usageRefusalKind> }
  | { kind: 'bad'; field: 'pair' | 'bars' | 'input' }
  | { kind: 'failed'; code?: string };

export function StrategyLab({
  strategies,
  initialPair,
  locale,
}: {
  strategies: EngineStrategy[];
  initialPair: string;
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
  const [history, setHistory] = useState<BacktestQueued[]>([]);
  const nf = new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US');

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
        | { ok: true; data: BacktestQueued }
        | { ok: false; error?: { reason?: string; usage?: string; supportCode?: string } }
        | null;
      if (j?.ok) {
        setOut({ kind: 'queued', job: j.data });
        setHistory((h) => [j.data, ...h].slice(0, 10));
      } else if (j && !j.ok && j.error?.reason === 'usage_refused')
        setOut({ kind: 'usage', refusal: usageRefusalKind(j.error.usage) });
      else if (r.status === 400) setOut({ kind: 'bad', field: 'input' });
      else setOut({ kind: 'failed', code: j && !j.ok ? j.error?.supportCode : undefined });
    } catch {
      setOut({ kind: 'failed' });
    } finally {
      setBusy(false);
    }
  }

  const name = (key: string) => strategies.find((s) => s.key === key)?.name ?? key;

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
            {busy ? t('sending') : t('submit')}
          </button>
        </form>
        <p className="ch-muted ch-mkt-note">{t('usesCredits')}</p>

        {out && (
          <div
            className={`ch-lab-out ch-lab-out--${out.kind === 'queued' ? 'ok' : 'bad'}`}
            role={out.kind === 'queued' ? 'status' : 'alert'}
          >
            {out.kind === 'queued' && (
              <p>
                {t('queued', {
                  estrategia: name(out.job.strategy),
                  par: out.job.pair,
                  tf: out.job.timeframe,
                  velas: nf.format(out.job.bars),
                })}
              </p>
            )}
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
            {out.kind === 'failed' && (
              <p>
                {t('failed')}
                {out.code ? ` ${t('code', { codigo: out.code })}` : ''}
              </p>
            )}
          </div>
        )}

        {history.length > 0 && (
          <div className="ch-lab-hist">
            <h3 className="ch-sig-h3">{t('histTitle')}</h3>
            <ul>
              {history.map((j) => (
                <li key={j.jobId}>
                  <span className="ch-pill ch-pill--gray">{t('statusQueued')}</span>
                  <span>
                    {name(j.strategy)} · <span className="ch-mono">{j.pair}</span> · {j.timeframe} ·{' '}
                    {t('barsN', { n: nf.format(j.bars) })}
                  </span>
                  <small className="ch-muted ch-mono">{j.jobId}</small>
                </li>
              ))}
            </ul>
            <p className="ch-muted ch-mkt-note">{t('histNote')}</p>
          </div>
        )}
      </section>
    </div>
  );
}
