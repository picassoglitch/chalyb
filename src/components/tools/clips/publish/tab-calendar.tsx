'use client';

// Calendario: one month, three sources — published through Clips, scheduled,
// and posts made directly on the networks (external). Click a day for its
// posts; "Próximos 7 días" lists what is about to go out. Times are local.

import { useEffect, useMemo, useState } from 'react';
import type { Route } from 'next';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { publishApi, usePublishErrorText } from './api';
import { PlatformList, parseWhen } from './common';

interface Entry {
  date: string | null;
  source: 'hub' | 'scheduled' | 'external';
  platforms: string[];
  content: string;
  status: string;
  post_id: string | null;
  clip_id: string | null;
  url: string | null;
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function CalendarTab() {
  const t = useTranslations('clipsPublish.calendar');
  const errText = usePublishErrorText();
  const locale = useLocale();
  const lc = locale === 'en' ? 'en' : 'es-MX';
  const [ref, setRef] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [agenda, setAgenda] = useState<Entry[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const from = ymd(new Date(ref.getFullYear(), ref.getMonth(), 0));
    const to = ymd(new Date(ref.getFullYear(), ref.getMonth() + 1, 1));
    void publishApi<{ entries: Entry[] }>('calendar.json', {
      query: { date_from: from, date_to: to },
    }).then((r) => {
      if (!live) return;
      if (r.ok) {
        setEntries(r.data.entries ?? []);
        setErr(null);
      } else {
        setEntries([]);
        setErr(errText(r.error));
      }
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- per month
  }, [ref]);

  useEffect(() => {
    const from = new Date();
    from.setDate(from.getDate() - 1);
    const to = new Date();
    to.setDate(to.getDate() + 8);
    void publishApi<{ entries: Entry[] }>('calendar.json', {
      query: { date_from: ymd(from), date_to: ymd(to) },
    }).then((r) => setAgenda(r.ok ? (r.data.entries ?? []) : []));
  }, []);

  const byDay = useMemo(() => {
    const m = new Map<string, Entry[]>();
    for (const e of entries ?? []) {
      const d = parseWhen(e.date);
      if (!d) continue;
      const k = ymd(d);
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return m;
  }, [entries]);

  const upcoming = useMemo(() => {
    const now = new Date();
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 7);
    return agenda
      .filter((e) => e.source === 'scheduled' && e.status !== 'deleted')
      .map((e) => ({ e, d: parseWhen(e.date) }))
      .filter((x): x is { e: Entry; d: Date } => !!x.d && x.d >= now && x.d <= horizon)
      .sort((a, b) => a.d.getTime() - b.d.getTime());
  }, [agenda]);

  const year = ref.getFullYear();
  const month = ref.getMonth();
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysIn = new Date(year, month + 1, 0).getDate();
  const today = ymd(new Date());
  const dows = t.raw('dows') as string[];
  function goMonth(delta: number) {
    setEntries(null);
    setDay(null);
    setRef(new Date(year, month + delta, 1));
  }
  const hour = (d: Date) => d.toLocaleTimeString(lc, { hour: '2-digit', minute: '2-digit' });

  const dayItems = day
    ? (byDay.get(day) ?? []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)))
    : [];

  return (
    <section className="ch-card ch-pub-sec" aria-labelledby="pub-cal-h">
      <header>
        <h2 id="pub-cal-h">{t('title')}</h2>
        <span className="ch-pub__push ch-pub-row">
          <button
            type="button"
            className="ch-btn ch-btn--gray ch-btn--tiny"
            aria-label={t('prev')}
            onClick={() => goMonth(-1)}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <b style={{ minWidth: 150, textAlign: 'center' }} aria-live="polite">
            {ref.toLocaleDateString(lc, { month: 'long', year: 'numeric' })}
          </b>
          <button
            type="button"
            className="ch-btn ch-btn--gray ch-btn--tiny"
            aria-label={t('next')}
            onClick={() => goMonth(1)}
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </span>
      </header>
      <div className="ch-pub-legend">
        <span>
          <i className="ch-pub-dot ch-pub-dot--hub" />
          {t('source.hub')}
        </span>
        <span>
          <i className="ch-pub-dot ch-pub-dot--scheduled" />
          {t('source.scheduled')}
        </span>
        <span>
          <i className="ch-pub-dot ch-pub-dot--external" />
          {t('source.external')}
        </span>
        <span className="ch-pub__push">{t('localTime')}</span>
      </div>

      {upcoming.length > 0 && (
        <div
          className="ch-card"
          style={{ padding: 14, boxShadow: 'inset 0 0 0 1.5px var(--tint)' }}
        >
          <b style={{ fontSize: 15 }}>{t('next7')}</b>
          <ul className="ch-pub-list">
            {upcoming.map(({ e, d }, i) => (
              <li key={`${e.post_id}-${i}`} className="ch-pub-item" style={{ padding: '6px 0' }}>
                <span style={{ minWidth: 120, fontWeight: 600, fontSize: 15 }}>
                  {d.toLocaleDateString(lc, { weekday: 'short', day: 'numeric', month: 'short' })}{' '}
                  {hour(d)}
                </span>
                <PlatformList ids={e.platforms} />
                <span className="ch-pub-item__tx">
                  <span className="ch-pub-hint">{e.content || t('noCaption')}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {err && <p className="ch-pub-err">{err}</p>}
      <div className="ch-pub-cal" aria-busy={entries === null}>
        {dows.map((d) => (
          <span key={d} className="ch-pub-cal__dow" aria-hidden="true">
            {d}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`l${i}`} />
        ))}
        {Array.from({ length: daysIn }, (_, i) => {
          const n = i + 1;
          const key = ymd(new Date(year, month, n));
          const items = (byDay.get(key) ?? []).filter((e) => e.status !== 'deleted');
          const pending = items.some((e) => e.source === 'scheduled');
          const external = items.some((e) => e.source === 'external');
          const plats = [...new Set(items.flatMap((e) => (e.platforms.length ? e.platforms : [])))];
          const cls = [
            'ch-pub-day',
            key === today ? 'ch-pub-day--today' : '',
            key < today ? 'ch-pub-day--past' : '',
            day === key ? 'ch-pub-day--sel' : '',
            items.length >= 4 ? 'ch-pub-day--heat2' : items.length ? 'ch-pub-day--heat1' : '',
          ]
            .filter(Boolean)
            .join(' ');
          const fecha = new Date(year, month, n).toLocaleDateString(lc, {
            day: 'numeric',
            month: 'long',
          });
          const label = t(items.length ? 'dayAria' : 'dayAriaNone', {
            fecha,
            n: items.length,
          });
          const body = (
            <>
              <span className="ch-pub-day__n">
                <span>
                  {n}
                  {key === today && ` · ${t('today')}`}
                </span>
                {items.length > 0 && (
                  <span className={pending ? 'ch-pub-day__c' : undefined}>
                    {items.length}
                    {external && <span className="ch-pub-day__ext"> ●</span>}
                  </span>
                )}
              </span>
              {plats.length > 0 && <PlatformList ids={plats.slice(0, 3)} />}
            </>
          );
          return items.length ? (
            <button
              key={key}
              type="button"
              className={cls}
              aria-label={label}
              aria-pressed={day === key}
              onClick={() => setDay(day === key ? null : key)}
            >
              {body}
            </button>
          ) : (
            <span key={key} className={cls} aria-label={label}>
              {body}
            </span>
          );
        })}
      </div>

      {day && (
        <div className="ch-pub-stack" aria-live="polite">
          <h3 style={{ fontSize: 18 }}>
            {parseWhen(`${day}T12:00:00Z`)?.toLocaleDateString(lc, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </h3>
          <ul className="ch-pub-list">
            {dayItems.map((e, i) => {
              const d = parseWhen(e.date);
              const deleted = e.status === 'deleted';
              const failed = ['failed', 'error'].includes(e.status.toLowerCase());
              return (
                <li
                  key={`${e.post_id}-${i}`}
                  className={`ch-pub-item${deleted ? ' ch-pub-item--dim' : ''}`}
                >
                  <span style={{ minWidth: 56, fontWeight: 600 }}>{d ? hour(d) : '—'}</span>
                  <span
                    className={`ch-pill ch-pill--${e.source === 'hub' ? 'ok' : e.source === 'scheduled' ? 'acc' : 'gray'}`}
                  >
                    {t(`source.${e.source}`)}
                  </span>
                  <PlatformList ids={e.platforms} />
                  {failed && <span className="ch-pub-err">{t('failed')}</span>}
                  {deleted && <span className="ch-pill ch-pill--gray">{t('deleted')}</span>}
                  <span className="ch-pub-item__tx">
                    <span className="ch-pub-hint">{e.content || t('noCaption')}</span>
                  </span>
                  {e.url && /^https?:\/\//.test(e.url) ? (
                    <a className="ch-lnk" href={e.url}>
                      {t('seePost')}
                    </a>
                  ) : e.clip_id ? (
                    <Link
                      className="ch-lnk"
                      href={`/app/clips/${encodeURIComponent(e.clip_id)}` as Route}
                    >
                      {t('seeClip')}
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
