'use client';

// Ajustes de Señales (TOOLS-SPEC §5.4, mockup 56). Every change saves itself
// through the BFF ("Guardando…" / "Guardado"). Only delivery preferences:
// which coins, how, when. No money fields exist here, and no exchange.

import { useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { AdvancedOptions } from '@/components/tools/advanced-options';
import type { Coin, SignalChannel, SignalPrefs } from '@/lib/tools/adapters/tools';

const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

export function SignalsSettingsForm({
  coins,
  channels,
  initial,
  maskedEmail,
  locale,
  legal,
}: {
  coins: Coin[];
  channels: SignalChannel[];
  initial: SignalPrefs;
  maskedEmail: string;
  locale: string;
  /** The "Información importante" group, rendered by the server. */
  legal: ReactNode;
}) {
  const t = useTranslations('signalsTool.settings');
  const ta = useTranslations('signalsTool.alerts');
  const ts = useTranslations('toolShell');
  const [prefs, setPrefs] = useState(initial);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [adding, setAdding] = useState(false);
  const seq = useRef(0);

  const hour = (hhmm: string) =>
    new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
    }).format(new Date(`1970-01-01T${hhmm}:00Z`));

  async function save(patch: Partial<SignalPrefs>) {
    const next = { ...prefs, ...patch };
    if (next.coins.length === 0) return;
    setPrefs(next);
    const n = ++seq.current;
    setStatus('saving');
    try {
      const res = await fetch('/api/tools/chalybcrypto/prefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(String(res.status));
      if (n === seq.current) setStatus('saved');
    } catch {
      if (n === seq.current) setStatus('error');
    }
  }

  const name = (sym: string) => coins.find((c) => c.symbol === sym)?.name ?? sym;
  const available = coins.filter((c) => !prefs.coins.includes(c.symbol));
  const toggleChannel = (c: SignalChannel, on: boolean) =>
    save({
      channels: on ? [...new Set([...prefs.channels, c])] : prefs.channels.filter((x) => x !== c),
    });

  return (
    <div className="ch-sigset">
      <div className="ch-sigset__cols">
        <div className="ch-sigset__col">
          <section aria-labelledby="sig-coins">
            <h2 id="sig-coins" className="ch-ghead">
              {t('coins')}
            </h2>
            <div className="ch-group">
              <div className="ch-sigset__pad">
                <ul className="ch-coinlist">
                  {prefs.coins.map((c) => (
                    <li key={c}>
                      <span className="ch-chip ch-chip--on">
                        {name(c)}
                        {prefs.coins.length > 1 && (
                          <button
                            type="button"
                            className="ch-coinlist__x"
                            aria-label={t('removeCoin', { moneda: name(c) })}
                            onClick={() => save({ coins: prefs.coins.filter((x) => x !== c) })}
                          >
                            <X aria-hidden="true" />
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                  {available.length > 0 && (
                    <li>
                      <button
                        type="button"
                        className="ch-chip ch-coinlist__add"
                        aria-expanded={adding}
                        onClick={() => setAdding((a) => !a)}
                      >
                        <Plus aria-hidden="true" />
                        {t('addCoin')}
                      </button>
                    </li>
                  )}
                </ul>
                {adding && (
                  <ul className="ch-coinlist" aria-label={t('addCoin')}>
                    {available.map((c) => (
                      <li key={c.symbol}>
                        <button
                          type="button"
                          className="ch-chip"
                          onClick={() => {
                            setAdding(false);
                            save({ coins: [...prefs.coins, c.symbol] });
                          }}
                        >
                          {c.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="ch-muted ch-sigset__hint">{t('coinsHint')}</p>
              </div>
            </div>
          </section>

          <section aria-labelledby="sig-how">
            <h2 id="sig-how" className="ch-ghead">
              {t('how')}
            </h2>
            <div className="ch-group">
              {channels.map((c) => (
                <div key={c} className="ch-row">
                  <span className="ch-row__tx">
                    <b>{ta(c)}</b>
                    <small>{c === 'email' ? maskedEmail : c === 'app' ? t('appHint') : ''}</small>
                  </span>
                  <Switch
                    checked={prefs.channels.includes(c)}
                    onChange={(on) => toggleChannel(c, on)}
                    label={ta(c)}
                  />
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="ch-sigset__col">
          <section aria-labelledby="sig-when">
            <h2 id="sig-when" className="ch-ghead">
              {t('when')}
            </h2>
            <div className="ch-group">
              <label className="ch-row">
                <span className="ch-row__tx">
                  <b>{t('from')}</b>
                </span>
                <select
                  className="ch-select"
                  value={prefs.from ?? '08:00'}
                  onChange={(e) => save({ from: e.target.value })}
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {hour(h)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ch-row">
                <span className="ch-row__tx">
                  <b>{t('to')}</b>
                  <small>{t('night')}</small>
                </span>
                <select
                  className="ch-select"
                  value={prefs.to ?? '22:00'}
                  onChange={(e) => save({ to: e.target.value })}
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {hour(h)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ch-row">
                <span className="ch-row__tx">
                  <b>{t('days')}</b>
                </span>
                <select
                  className="ch-select"
                  value={prefs.days ?? 'all'}
                  onChange={(e) =>
                    save({ days: e.target.value === 'weekdays' ? 'weekdays' : 'all' })
                  }
                >
                  <option value="all">{t('daysAll')}</option>
                  <option value="weekdays">{t('daysWeekdays')}</option>
                </select>
              </label>
            </div>
          </section>
          {legal}
        </div>
      </div>

      <AdvancedOptions
        storageKey="senales.settings"
        title={ts('advanced.title')}
        sub={ts('advanced.sub')}
        summary={t('advSummary')}
      >
        <div className="ch-sigset__adv">
          <label className="ch-row">
            <span className="ch-row__tx">
              <b>{t('timeframe')}</b>
              <small>{t('timeframeHint')}</small>
            </span>
            <select
              className="ch-select"
              value={prefs.timeframe}
              onChange={(e) => save({ timeframe: e.target.value === 'week' ? 'week' : 'day' })}
            >
              <option value="day">{t('short')}</option>
              <option value="week">{t('medium')}</option>
            </select>
          </label>
          <div className="ch-row">
            <span className="ch-row__tx">
              <b>{t('daily')}</b>
              <small>{t('dailyHint')}</small>
            </span>
            <Switch
              checked={!!prefs.dailySummary}
              onChange={(on) => save({ dailySummary: on })}
              label={t('daily')}
            />
          </div>
          <label className="ch-row">
            <span className="ch-row__tx">
              <b>{t('format')}</b>
            </span>
            <select
              className="ch-select"
              value={prefs.format ?? 'short'}
              onChange={(e) =>
                save({ format: e.target.value === 'explained' ? 'explained' : 'short' })
              }
            >
              <option value="short">{t('formatShort')}</option>
              <option value="explained">{t('formatExplained')}</option>
            </select>
          </label>
        </div>
      </AdvancedOptions>

      <p className="ch-muted ch-sigset__save" aria-live="polite">
        {status === 'saving'
          ? ts('saving')
          : status === 'error'
            ? t('error')
            : status === 'saved'
              ? ts('saved')
              : ts('autosave')}
      </p>
    </div>
  );
}
