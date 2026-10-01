'use client';

// En vivo (SCR-22): one giant button, scenes, quick controls, and a
// confirmation before ending.

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Mic, Video, Scissors, Wifi } from 'lucide-react';
import { liveAction } from '@/lib/tools/envivo-actions';
import type { LiveStatus } from '@/lib/tools/adapters/tools';
import { Switch } from '@/components/ui/switch';
import { Sheet } from '@/components/ui/sheet';
import { Pill } from '@/components/ui/primitives';

function elapsed(since: string, now: number) {
  const s = Math.max(0, Math.floor((now - Date.parse(since)) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function LiveConsole({ initial }: { initial: LiveStatus }) {
  const t = useTranslations('live');
  const [s, setS] = useState(initial);
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!s.liveSince) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [s.liveSince]);
  const run = (a: Parameters<typeof liveAction>[0]) =>
    start(async () => {
      const next = await liveAction(a);
      if (next) setS(next);
    });
  const live = !!s.liveSince;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <header style={{ display: 'grid', gap: 6 }}>
        <h1 className="ch-h1">{t('title')}</h1>
        <p className="ch-sub">{t('sub')}</p>
        <p style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Pill kind="ok" check>{t('obsOk')}</Pill>
          <span className="ch-muted">{t('platforms', { plataformas: s.platforms.join(', ') })}</span>
        </p>
      </header>

      {live ? (
        <button type="button" className="ch-giant ch-giant--stop" onClick={() => setConfirm(true)} disabled={pending}>
          {t('stop')}
          <span className="ch-giant__sub">{t('liveFor', { tiempo: elapsed(s.liveSince!, now) })}</span>
        </button>
      ) : (
        <button type="button" className="ch-giant" onClick={() => run({ kind: 'start' })} disabled={pending}>
          {t('start')}
          <span className="ch-giant__sub">{t('startSub')}</span>
        </button>
      )}

      <section aria-labelledby="scenes-t" style={{ display: 'grid', gap: 10 }}>
        <h2 id="scenes-t" className="ch-h2">{t('scenes')}</h2>
        <p className="ch-muted">{t('scenesSub')}</p>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
          {s.scenes.map((sc) => (
            <button
              key={sc.id}
              type="button"
              aria-pressed={s.activeSceneId === sc.id}
              className="ch-card ch-scene"
              onClick={() => run({ kind: 'scene', id: sc.id })}
            >
              <b>{sc.name}</b>
              {s.activeSceneId === sc.id && <Pill kind="acc">{t('onAir')}</Pill>}
            </button>
          ))}
        </div>
      </section>

      <section className="ch-group" aria-label={t('quick')}>
        {(
          [
            ['mic', Mic],
            ['cam', Video],
            ['clipsAfter', Scissors],
          ] as const
        ).map(([what, Icon]) => (
          <div key={what} className="ch-row">
            <span className="ch-row__ic" aria-hidden="true">
              <Icon />
            </span>
            <span className="ch-row__tx">
              <b>{t(what)}</b>
            </span>
            <Switch checked={s[what]} label={t(what)} onChange={() => run({ kind: 'toggle', what })} />
          </div>
        ))}
      </section>

      <section className="ch-group" aria-label={t('check')}>
        <div className="ch-row">
          <span className="ch-row__ic" aria-hidden="true">
            <Wifi />
          </span>
          <span className="ch-row__tx">
            <b>{t('internet')}</b>
          </span>
          <Pill kind={s.internet === 'good' ? 'ok' : s.internet === 'slow' ? 'warn' : 'bad'}>{t(s.internet)}</Pill>
        </div>
        <div className="ch-row">
          <span className="ch-row__tx">
            <b>{t('streamTitle')}</b>
            <small>{s.title}</small>
          </span>
        </div>
      </section>

      <details className="ch-card" style={{ padding: '14px 18px' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, minHeight: 32 }}>{t('adv')}</summary>
        <p className="ch-muted" style={{ marginTop: 8 }}>{t('advBody')}</p>
      </details>

      <Sheet open={confirm} onClose={() => setConfirm(false)} title={t('confirmTitle')} closeLabel={t('confirmNo')}>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
          <button
            type="button"
            className="ch-btn ch-btn--danger"
            onClick={() => {
              setConfirm(false);
              run({ kind: 'stop' });
            }}
          >
            {t('confirmYes')}
          </button>
          <button type="button" className="ch-btn ch-btn--primary" onClick={() => setConfirm(false)}>
            {t('confirmNo')}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
