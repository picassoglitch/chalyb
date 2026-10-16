'use client';

// Programación: auto-program the whole approved backlog (paced per network,
// best hours first), the recurring queue slots, the best hours, and the
// upcoming posts with "Cancelar".

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarClock, Plus, Save, Wand2, X } from 'lucide-react';
import { publishApi, usePublishErrorText } from './api';
import { InlineMsg, PlatformList, useConfirm, useFormatWhen, type Msg } from './common';
import type { TabProps } from './publish-center';

interface Slot {
  dayOfWeek: number;
  time: string;
}
interface Queue {
  _id?: string;
  isDefault?: boolean;
  timezone?: string;
  slots?: { dayOfWeek?: number; time?: string }[];
}
interface Upcoming {
  post_id: string;
  content: string;
  scheduled_for: string | null;
  platforms: string[];
}
interface Progress {
  state: 'idle' | 'running' | 'done' | 'error';
  total?: number;
  done?: number;
  scheduled?: number;
  failed?: number;
  cooled?: string[];
  error?: string;
}

/** Zernio's queue slots: 0 = Sunday … 6 = Saturday. Shown Monday first. */
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function ScheduleTab({ ov, refresh }: TabProps) {
  const t = useTranslations('clipsPublish.schedule');
  const errText = usePublishErrorText();
  const fmt = useFormatWhen();
  const [ask, confirmNode] = useConfirm();
  const dowNames = t.raw('dows') as string[]; // index = Zernio dayOfWeek (0 = Sunday)
  const bestDows = t.raw('bestDows') as string[]; // index = best-time day (0 = Monday)

  const [slots, setSlots] = useState<Slot[]>([]);
  const [dow, setDow] = useState(1);
  const [time, setTime] = useState('18:00');
  const [tz, setTz] = useState('UTC');
  const [slotMsg, setSlotMsg] = useState<Msg>(null);
  const [upcoming, setUpcoming] = useState<Upcoming[] | null>(null);
  const [upErr, setUpErr] = useState<string | null>(null);
  const [best, setBest] = useState<{ day_of_week: number; hour: number }[] | null>(null);
  const [autoMsg, setAutoMsg] = useState<Msg>(null);
  const [autoBusy, setAutoBusy] = useState(false);
  // Clips this run already scheduled (the backlog count drops as they go).
  const [doneInRun, setDoneInRun] = useState<{ base: number; scheduled: number } | null>(null);
  const left = doneInRun ? Math.max(0, doneInRun.base - doneInRun.scheduled) : ov.publishable_total;
  const [rowMsg, setRowMsg] = useState<Msg>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  function loadSchedule() {
    return publishApi<{ queues: Queue[]; upcoming: Upcoming[] }>('schedule.json').then((r) => {
      if (!r.ok) {
        setUpErr(errText(r.error));
        setUpcoming([]);
        return;
      }
      setUpErr(null);
      const queues = r.data.queues ?? [];
      const def = queues.find((q) => q.isDefault) ?? queues[0];
      if (def?.slots) {
        setSlots(
          def.slots
            .filter((s): s is Slot => typeof s.dayOfWeek === 'number' && !!s.time)
            .map((s) => ({ dayOfWeek: s.dayOfWeek, time: s.time })),
        );
        if (def.timezone) setTz(def.timezone);
      }
      setUpcoming(r.data.upcoming ?? []);
    });
  }

  useEffect(() => {
    void loadSchedule();
    void publishApi<{ slots: { day_of_week: number; hour: number }[] }>('best-time.json').then(
      (r) => setBest(r.ok ? (r.data.slots ?? []).slice(0, 5) : []),
    );
    return () => {
      if (poll.current) clearInterval(poll.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once
  }, []);

  function progressText(p: Progress, count: number): Msg {
    const failed = p.failed ? t('autoFailed', { n: p.failed }) : '';
    const cooled = p.cooled?.length ? t('autoCooled', { redes: p.cooled.join(', ') }) : '';
    if (p.state === 'done')
      return {
        kind: p.failed || cooled ? 'info' : 'ok',
        text: `${p.scheduled ? t('autoDone', { n: p.scheduled }) : t('autoDoneNone')}${failed}${cooled}`,
      };
    return {
      kind: 'info',
      text: `${t('autoRunning', { done: p.done ?? 0, total: p.total ?? count, ok: p.scheduled ?? 0 })}${failed}${cooled}`,
    };
  }

  function startAuto() {
    const count = left;
    if (count <= 0) {
      setAutoMsg({ kind: 'info', text: t('autoNone') });
      return;
    }
    ask({
      title: t('autoConfirm', { n: count }),
      body: t('autoConfirmBody'),
      cta: t('autoCta', { n: count }),
      onConfirm: async () => {
        setAutoBusy(true);
        setAutoMsg({ kind: 'info', text: t('autoStarting') });
        const r = await publishApi<Progress & { ok: boolean; message?: string }>('schedule/auto', {
          method: 'POST',
        });
        if (!r.ok) {
          setAutoBusy(false);
          setAutoMsg({ kind: 'bad', text: errText(r.error) });
          return;
        }
        if (r.data.state === 'done') {
          setAutoBusy(false);
          setAutoMsg({ kind: 'info', text: r.data.message || t('autoNone') });
          return;
        }
        const tick = async () => {
          const p = await publishApi<Progress>('schedule/auto/progress');
          if (!p.ok) return; // transient: keep polling
          setAutoMsg(progressText(p.data, count));
          setDoneInRun({ base: count, scheduled: p.data.scheduled ?? 0 });
          if (p.data.state === 'done' || p.data.state === 'error' || p.data.state === 'idle') {
            if (poll.current) clearInterval(poll.current);
            poll.current = null;
            setAutoBusy(false);
            if (p.data.state === 'error') setAutoMsg({ kind: 'bad', text: t('autoError') });
            await loadSchedule();
            await refresh();
            setDoneInRun(null);
          }
        };
        poll.current = setInterval(() => void tick(), 1000);
        void tick();
      },
    });
  }

  const sorted = slots
    .slice()
    .sort(
      (a, b) =>
        DOW_ORDER.indexOf(a.dayOfWeek) - DOW_ORDER.indexOf(b.dayOfWeek) ||
        a.time.localeCompare(b.time),
    );

  return (
    <div className="ch-pub-stack">
      <section className="ch-card ch-pub-sec" aria-labelledby="pub-auto-h">
        <header>
          <Wand2 aria-hidden="true" style={{ color: 'var(--accent)' }} />
          <h2 id="pub-auto-h">{t('autoTitle')}</h2>
        </header>
        <p className="ch-muted">{t('autoBody')}</p>
        <div className="ch-pub-row">
          <button
            type="button"
            className="ch-btn ch-btn--primary ch-btn--compact"
            disabled={autoBusy}
            onClick={startAuto}
          >
            <CalendarClock aria-hidden="true" />
            {t('autoCta', { n: left })}
          </button>
          <InlineMsg msg={autoMsg} />
        </div>
      </section>

      <section className="ch-card ch-pub-sec" aria-labelledby="pub-slots-h">
        <header>
          <h2 id="pub-slots-h">{t('slotsTitle')}</h2>
        </header>
        <p className="ch-muted">{t('slotsHint')}</p>
        <div className="ch-pub-row" style={{ alignItems: 'flex-end' }}>
          <label className="ch-pub-field">
            <span>{t('day')}</span>
            <select
              className="ch-select"
              value={dow}
              onChange={(e) => setDow(Number(e.target.value))}
            >
              {DOW_ORDER.map((d) => (
                <option key={d} value={d}>
                  {dowNames[d]}
                </option>
              ))}
            </select>
          </label>
          <label className="ch-pub-field">
            <span>{t('time')}</span>
            <input
              className="ch-input"
              type="time"
              value={time}
              style={{ width: 'auto' }}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
          <label className="ch-pub-field">
            <span>{t('timezone')}</span>
            <input
              className="ch-input"
              value={tz}
              style={{ width: 220 }}
              placeholder="UTC"
              onChange={(e) => setTz(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="ch-btn ch-btn--gray ch-btn--compact"
            onClick={() => {
              if (!time) return;
              if (slots.some((s) => s.dayOfWeek === dow && s.time === time)) return;
              setSlots([...slots, { dayOfWeek: dow, time }]);
            }}
          >
            <Plus aria-hidden="true" />
            {t('addSlot')}
          </button>
        </div>
        <div className="ch-pub-chips">
          {sorted.length === 0 ? (
            <span className="ch-pub-hint">{t('noSlots')}</span>
          ) : (
            sorted.map((s) => (
              <span key={`${s.dayOfWeek}-${s.time}`} className="ch-pub-acct">
                {dowNames[s.dayOfWeek]} {s.time}
                <button
                  type="button"
                  className="ch-pub-acct__x"
                  aria-label={t('removeSlot', { dia: dowNames[s.dayOfWeek] ?? '', hora: s.time })}
                  onClick={() =>
                    setSlots(
                      slots.filter((o) => !(o.dayOfWeek === s.dayOfWeek && o.time === s.time)),
                    )
                  }
                >
                  <X aria-hidden="true" />
                </button>
              </span>
            ))
          )}
        </div>
        <div className="ch-pub-row">
          <button
            type="button"
            className="ch-btn ch-btn--primary ch-btn--compact"
            onClick={async () => {
              if (!slots.length) {
                setSlotMsg({ kind: 'bad', text: t('needSlot') });
                return;
              }
              setSlotMsg({ kind: 'info', text: t('saving') });
              const r = await publishApi('schedule/slots', {
                body: { timezone: tz || 'UTC', slots },
              });
              setSlotMsg(
                r.ok ? { kind: 'ok', text: t('saved') } : { kind: 'bad', text: errText(r.error) },
              );
            }}
          >
            <Save aria-hidden="true" />
            {t('saveSlots')}
          </button>
          <InlineMsg msg={slotMsg} />
        </div>
      </section>

      <section className="ch-card ch-pub-sec" aria-labelledby="pub-best-h">
        <header>
          <h2 id="pub-best-h">{t('bestTitle')}</h2>
        </header>
        <p className="ch-muted">{t('bestHint')}</p>
        {best === null ? (
          <p className="ch-pub-hint">{t('loading')}</p>
        ) : best.length === 0 ? (
          <p className="ch-pub-hint">{t('bestNone')}</p>
        ) : (
          <div className="ch-pub-chips">
            {best.map((s, i) => (
              <span key={i} className="ch-pub-acct" style={{ padding: '0 14px' }}>
                {bestDows[s.day_of_week] ?? '?'} {String(s.hour).padStart(2, '0')}:00 UTC
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="ch-card ch-pub-sec" aria-labelledby="pub-up-h">
        <header>
          <h2 id="pub-up-h">{t('upcomingTitle')}</h2>
        </header>
        <InlineMsg msg={rowMsg} />
        {upcoming === null ? (
          <p className="ch-pub-hint">{t('loading')}</p>
        ) : upErr ? (
          <p className="ch-pub-err">{upErr}</p>
        ) : upcoming.length === 0 ? (
          <p className="ch-pub-hint">{t('noUpcoming')}</p>
        ) : (
          <ul className="ch-pub-list">
            {upcoming.map((p) => (
              <li key={p.post_id} className="ch-pub-item">
                <PlatformList ids={p.platforms.filter(Boolean)} />
                <span className="ch-pub-item__tx">
                  <b>{p.content || t('noCaption')}</b>
                  <small>{fmt(p.scheduled_for)}</small>
                </span>
                <button
                  type="button"
                  className="ch-btn ch-btn--danger ch-btn--tiny"
                  onClick={() =>
                    ask({
                      title: t('cancelTitle'),
                      body: t('cancelBody'),
                      cta: t('cancel'),
                      danger: true,
                      onConfirm: async () => {
                        const r = await publishApi(
                          `schedule/cancel/${encodeURIComponent(p.post_id)}`,
                          { method: 'POST' },
                        );
                        if (!r.ok) {
                          setRowMsg({ kind: 'bad', text: errText(r.error) });
                          return;
                        }
                        setUpcoming((u) => (u ?? []).filter((x) => x.post_id !== p.post_id));
                        await refresh();
                      },
                    })
                  }
                >
                  <X aria-hidden="true" />
                  {t('cancel')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {confirmNode}
    </div>
  );
}
