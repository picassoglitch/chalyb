'use client';

// Transmitir (TOOLS-SPEC §6.2). Off air: screen 22 inside ToolShell (one
// giant "Iniciar transmisión"). Live: mockup 58 — the status bar, the
// preview, scenes, and "Terminar transmisión" as the only primary, behind a
// confirm sheet. State comes from the BFF; polled every 5 s as the SSE
// fallback.

import { useEffect, useState, useTransition } from 'react';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import {
  Camera,
  Check,
  Circle,
  Coffee,
  Eye,
  MessageCircle,
  Mic,
  MicOff,
  Monitor,
  Radio,
  Scissors,
  Square,
  Video,
  VideoOff,
  Wifi,
} from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Sheet } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Pill } from '@/components/ui/primitives';
import { AdvancedOptions } from '@/components/tools/advanced-options';
import type { LiveQuality, LiveStatus } from '@/lib/tools/adapters/tools';
import { clipNowState, formatDuration, formatElapsed } from '@/lib/tools/envivo-core';

const POLL_MS = 5000;
const SCENE_ICONS = [Camera, Monitor, Coffee];

type Command =
  | 'start_stream'
  | 'stop_stream'
  | 'set_scene'
  | 'set_mic'
  | 'set_cam'
  | 'set_clips_after';

interface CommandResult {
  status: LiveStatus;
  endedSec: number | null;
  recordingUrl?: string | null;
}

export function LiveRoom({
  initial,
  quality,
  saveRecording,
  clipsReady,
  advanced,
}: {
  initial: LiveStatus;
  quality: LiveQuality;
  saveRecording: boolean;
  /** Clips is included and running, so "Hacer clip de este momento" works. */
  clipsReady: boolean;
  advanced: { title: string; sub: string };
}) {
  const t = useTranslations('liveTool.room');
  const [s, setS] = useState(initial);
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [ended, setEnded] = useState<{ sec: number; recordingUrl: string | null } | null>(null);
  const [error, setError] = useState<'start' | 'action' | null>(null);
  const [clipMsg, setClipMsg] = useState<'done' | 'error' | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const live = !!s.liveSince;

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [live]);

  async function refresh() {
    try {
      const res = await fetch('/api/tools/chalybobs/status', { cache: 'no-store' });
      const json = (await res.json()) as { ok: boolean; data?: LiveStatus };
      if (json.ok && json.data) setS(json.data);
    } catch {}
  }

  useEffect(() => {
    const id = window.setInterval(refresh, POLL_MS);
    return () => window.clearInterval(id);
  }, []);

  function run(type: Command, extra: Record<string, string> = {}) {
    setError(null);
    start(async () => {
      try {
        const res = await fetch('/api/tools/chalybobs/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, ...extra }),
        });
        const json = (await res.json()) as { ok: boolean; data?: CommandResult };
        if (!json.ok || !json.data) throw new Error('command');
        setS(json.data.status);
        if (type === 'stop_stream' && json.data.endedSec)
          setEnded({ sec: json.data.endedSec, recordingUrl: json.data.recordingUrl ?? null });
        if (type === 'start_stream') setEnded(null);
      } catch {
        setError(type === 'start_stream' ? 'start' : 'action');
      }
    });
  }

  function clipNow() {
    setClipMsg(null);
    start(async () => {
      try {
        const res = await fetch('/api/tools/chalybobs/clip-now', { method: 'POST' });
        const json = (await res.json()) as { ok: boolean };
        setClipMsg(json.ok ? 'done' : 'error');
      } catch {
        setClipMsg('error');
      }
    });
  }

  const noDestination = s.platforms.length === 0;
  const lost = live && !s.obsConnected;
  const clip = clipNowState({ live, saveRecording });
  const internetKind = s.internet === 'good' ? 'ok' : s.internet === 'slow' ? 'warn' : 'bad';

  const scenes = (
    <section aria-labelledby="scenes-t" className="ch-live__scenes">
      <div className="ch-live__sechead">
        <h2 id="scenes-t" className="ch-h3">
          {t('scenes')}
        </h2>
        <p className="ch-muted">{t('scenesSub')}</p>
      </div>
      <div className="ch-live__scenegrid">
        {s.scenes.map((sc, i) => {
          const Icon = SCENE_ICONS[i % SCENE_ICONS.length]!;
          const on = s.activeSceneId === sc.id;
          return (
            <button
              key={sc.id}
              type="button"
              aria-pressed={on}
              className="ch-scenecard"
              disabled={pending}
              onClick={() => run('set_scene', { sceneId: sc.id })}
            >
              <span className={`ch-scenecard__thumb ch-scenecard__thumb--${i % 3}`}>
                <span className="ch-scenecard__ic" aria-hidden="true">
                  <Icon />
                </span>
              </span>
              <b>{sc.name}</b>
              <span className={on ? 'ch-scenecard__on' : 'ch-muted'}>
                {on ? t('onAir') : (sc.note ?? '')}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );

  const adv = (
    <AdvancedOptions
      storageKey="envivo.room"
      title={advanced.title}
      sub={advanced.sub}
      summary={t('advSummary')}
    >
      <p className="ch-muted">
        {t('advBody')}{' '}
        <Link href={'/app/en-vivo/ajustes' as Route} className="ch-lnk">
          {t('advLink')}
        </Link>
      </p>
    </AdvancedOptions>
  );

  const errorBox = error && (
    <div role="alert" className="ch-live__alert">
      <p>
        {error === 'start'
          ? t('startError', { plataforma: s.platforms[0] ?? 'YouTube' })
          : t('actionError')}
      </p>
      {error === 'start' && (
        <div className="ch-live__alertbtns">
          <button
            type="button"
            className="ch-btn ch-btn--secondary"
            onClick={() => run('start_stream')}
          >
            {t('retry')}
          </button>
          <Link href={'/app/help' as Route} className="ch-btn ch-btn--okline">
            <MessageCircle aria-hidden="true" />
            {t('human')}
          </Link>
        </div>
      )}
    </div>
  );

  if (live) {
    return (
      <div className="ch-live" data-state="live">
        <div className="ch-live__bar" role="group" aria-label={t('onLabel')}>
          <span className="ch-live__on" role="timer" aria-live="polite">
            <span className="ch-live__dot" aria-hidden="true" />
            {t('on', { tiempo: formatElapsed(s.liveSince!, now) })}
          </span>
          {s.viewers !== null && (
            <span className="ch-live__item">
              <Eye aria-hidden="true" />
              {t('viewers', { n: s.viewers })}
            </span>
          )}
          <span className="ch-live__item">
            <Radio aria-hidden="true" />
            {s.platforms.join(' · ')}
          </span>
          <span className="ch-live__item">
            <Wifi aria-hidden="true" />
            {t('internet')}{' '}
            <b className={`ch-live__net ch-live__net--${internetKind}`}>{t(s.internet)}</b>
          </span>
        </div>
        {s.internet === 'slow' && quality === 'auto' && (
          <p className="ch-muted ch-live__note">{t('slowNote')}</p>
        )}
        {lost && (
          <div role="alert" className="ch-live__lost">
            <p>{t('lost')}</p>
            <button type="button" className="ch-btn ch-btn--white" onClick={() => void refresh()}>
              {t('reconnect')}
            </button>
          </div>
        )}
        {errorBox}
        <div className="ch-live__grid">
          <div className="ch-live__main">
            <div className="ch-live__preview">
              <span className="ch-live__tag">{t('previewLive')}</span>
              <span className="ch-live__pl">{t('previewLabel')}</span>
            </div>
            {scenes}
          </div>
          <aside className="ch-live__side">
            <div>
              <button
                type="button"
                className="ch-giant ch-giant--stop ch-live__giant"
                onClick={() => setConfirm(true)}
                disabled={pending}
              >
                <Square aria-hidden="true" />
                {t('stop')}
              </button>
              <p className="ch-muted ch-live__under">{t('stopSub')}</p>
            </div>
            <div className="ch-live__toggles">
              <button
                type="button"
                className={`ch-bigtoggle${s.mic ? ' ch-bigtoggle--on' : ''}`}
                aria-pressed={s.mic}
                onClick={() => run('set_mic')}
                disabled={pending}
              >
                <span className="ch-bigtoggle__ic" aria-hidden="true">
                  {s.mic ? <Mic /> : <MicOff />}
                </span>
                <b>{t('mic')}</b>
                <span>{s.mic ? t('micOn') : t('micOff')}</span>
              </button>
              <button
                type="button"
                className={`ch-bigtoggle${s.cam ? ' ch-bigtoggle--on' : ''}`}
                aria-pressed={s.cam}
                onClick={() => run('set_cam')}
                disabled={pending}
              >
                <span className="ch-bigtoggle__ic" aria-hidden="true">
                  {s.cam ? <Video /> : <VideoOff />}
                </span>
                <b>{t('cam')}</b>
                <span>{s.cam ? t('camOn') : t('camOff')}</span>
              </button>
            </div>
            {clipsReady && (
              <div>
                <button
                  type="button"
                  className="ch-btn ch-btn--secondary ch-live__clip"
                  onClick={clipNow}
                  disabled={pending || clip !== 'ready'}
                >
                  <Scissors aria-hidden="true" />
                  {t('clipNow')}
                </button>
                <p className="ch-muted ch-live__under" role="status">
                  {clip === 'needsRecording'
                    ? t('clipNowNeedsRec')
                    : clipMsg === 'done'
                      ? t('clipNowDone')
                      : clipMsg === 'error'
                        ? t('clipNowError')
                        : t('clipNowSub')}
                </p>
              </div>
            )}
            {adv}
          </aside>
        </div>

        <Sheet
          open={confirm}
          onClose={() => setConfirm(false)}
          title={t('confirmTitle')}
          closeLabel={t('confirmNo')}
        >
          <p className="ch-muted" style={{ marginBottom: 20 }}>
            {t('confirmBody')}
          </p>
          <div className="ch-live__confirm">
            <button
              type="button"
              className="ch-btn ch-btn--dark"
              onClick={() => {
                setConfirm(false);
                run('stop_stream');
              }}
            >
              {t('confirmYes')}
            </button>
            <button
              type="button"
              className="ch-btn ch-btn--primary"
              onClick={() => setConfirm(false)}
            >
              {t('confirmNo')}
            </button>
          </div>
        </Sheet>
      </div>
    );
  }

  return (
    <div className="ch-live" data-state="off">
      <header className="ch-live__head">
        <h2 className="ch-h2">{t('title')}</h2>
        <p className="ch-sub">{t('sub')}</p>
      </header>
      {errorBox}
      <div className="ch-live__grid">
        <div className="ch-live__main">
          {ended && (
            <section className="ch-card ch-live__ended" aria-live="polite">
              <p>
                <b>{t('ended', { duracion: formatDuration(ended.sec) })}</b>
              </p>
              <div className="ch-live__alertbtns">
                <Link
                  href={
                    (ended.recordingUrl
                      ? `/app/clips/nuevo?link=${encodeURIComponent(ended.recordingUrl)}`
                      : '/app/clips/nuevo') as Route
                  }
                  className="ch-btn ch-btn--primary"
                >
                  <Scissors aria-hidden="true" />
                  {t('endedClips')}
                </Link>
                <Link
                  href={'/app/en-vivo/transmisiones' as Route}
                  className="ch-btn ch-btn--secondary"
                >
                  {t('endedList')}
                </Link>
              </div>
            </section>
          )}
          <div className="ch-card ch-live__obs">
            <span className="ch-live__ok" aria-hidden="true">
              <Check />
            </span>
            <span className="ch-live__obstx">
              <b>{t('obsOk')}</b>
              {!noDestination && (
                <span className="ch-muted">
                  {t('platforms', { plataformas: s.platforms.join(' · ') })}
                </span>
              )}
            </span>
            <Link href={'/app/en-vivo/ajustes' as Route} className="ch-lnk">
              {t('change')}
            </Link>
          </div>
          {noDestination ? (
            <section className="ch-card ch-state" aria-labelledby="nodest-t">
              <h3 id="nodest-t" className="ch-h2">
                {t('noDestTitle')}
              </h3>
              <p className="ch-muted">{t('noDestBody')}</p>
              <Link href={'/app/en-vivo/ajustes' as Route} className="ch-btn ch-btn--primary">
                {t('noDestCta')}
              </Link>
            </section>
          ) : (
            <div>
              <button
                type="button"
                className={`ch-giant ch-live__giant${ended ? ' ch-giant--quiet' : ''}`}
                onClick={() => run('start_stream')}
                disabled={pending}
              >
                <Circle aria-hidden="true" />
                {t('start')}
              </button>
              <p className="ch-muted ch-live__under">{t('startSub')}</p>
            </div>
          )}
          {scenes}
        </div>
        <aside className="ch-live__side">
          <section className="ch-card ch-live__panel" aria-labelledby="quick-t">
            <h3 id="quick-t" className="ch-h3">
              {t('quick')}
            </h3>
            {(
              [
                ['mic', 'set_mic', Mic],
                ['cam', 'set_cam', Video],
                ['clipsAfter', 'set_clips_after', Scissors],
              ] as const
            ).map(([what, cmd, Icon]) => (
              <div key={what} className="ch-live__row">
                <span className={`ch-live__ric ch-live__ric--${what}`} aria-hidden="true">
                  <Icon />
                </span>
                <span className="ch-live__rtx">{t(what)}</span>
                <Switch
                  checked={s[what]}
                  label={t(what)}
                  disabled={pending}
                  onChange={() => run(cmd)}
                />
              </div>
            ))}
          </section>
          <section className="ch-card ch-live__panel" aria-labelledby="before-t">
            <h3 id="before-t" className="ch-h3">
              {t('before')}
            </h3>
            <div className="ch-live__row">
              <span className="ch-live__rtx">{t('internet')}</span>
              <Pill kind={internetKind} check={s.internet === 'good'}>
                {t(s.internet)}
              </Pill>
            </div>
            {s.internet === 'slow' && quality === 'auto' && (
              <p className="ch-muted">{t('slowNote')}</p>
            )}
            <div className="ch-live__row">
              <span className="ch-live__rtx">
                {t('streamTitle')}
                <small className="ch-muted">{s.title}</small>
              </span>
            </div>
          </section>
          {adv}
        </aside>
      </div>
    </div>
  );
}
