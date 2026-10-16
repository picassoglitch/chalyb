'use client';

// En vivo · Transmitir: everything the engine's dashboard does, in the hub.
// Title, live/offline, the preview (with the encoder card inside while
// there's no signal), the Clips connection, and the channels the stream is
// re-sent to (add, sign in, edit, on/off, remove, "Actualizar títulos").
// State comes from the BFF and is refreshed every 10 s and after each change.

import { useCallback, useEffect, useState } from 'react';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import { Pencil, Plus, Radio, Scissors, TriangleAlert, X } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Sheet } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import {
  destinationConfigured,
  isOAuthPlatform,
  PLATFORM_IDS,
  PLATFORM_META,
  type OAuthPlatform,
  type PlatformId,
} from '@/lib/tools/envivo-platforms';
import type { LiveDestination, LiveState } from '@/lib/tools/adapters/tools';
import { ConnectAccountSheet } from './connect-account-sheet';
import { ChannelEdit } from './channel-edit';
import { BroadcastComposer } from './broadcast-composer';
import { EncoderCard } from './encoder-card';
import { StreamPreview } from './stream-preview';

const POLL_MS = 10_000;

export type ConnectNotice = { kind: 'ok' | 'error'; code: string } | null;

type ApiResult = { ok: boolean; data?: LiveState; error?: { reason?: string } };

async function api(path: string, method: string, body?: unknown): Promise<ApiResult> {
  try {
    const res = await fetch(`/api/tools/chalybobs/${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
    return (await res.json()) as ApiResult;
  } catch {
    return { ok: false };
  }
}

/** Notice copy from `?connected=` / `?connect_error=` (<platform>_<reason>). */
function useNoticeText() {
  const t = useTranslations('liveTool.notice');
  return (n: NonNullable<ConnectNotice>) => {
    const sep = n.code.indexOf('_');
    const p = n.kind === 'ok' ? n.code : sep > 0 ? n.code.slice(0, sep) : '';
    const plataforma = isOAuthPlatform(p) ? PLATFORM_META[p].name : '—';
    if (n.kind === 'ok') return t('connected', { plataforma });
    const reason = sep > 0 ? n.code.slice(sep + 1) : n.code;
    if (reason === 'denied') return t('denied', { plataforma });
    if (reason === 'not_configured') return t('notConfigured', { plataforma });
    if (reason === 'state_mismatch') return t('stateMismatch');
    return t('failed', { plataforma });
  };
}

export function EnVivoStudio({
  initial,
  previewUrl,
  notice: initialNotice,
}: {
  initial: LiveState;
  previewUrl: string | null;
  notice: ConnectNotice;
}) {
  const t = useTranslations('liveTool.room');
  const tc = useTranslations('liveTool.channels');
  const tn = useTranslations('liveTool.notice');
  const noticeText = useNoticeText();
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'action' | 'plan' | null>(null);
  const [notice, setNotice] = useState<ConnectNotice>(initialNotice);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(initial.title);
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<LiveDestination | null>(null);
  const [removing, setRemoving] = useState<LiveDestination | null>(null);
  const [composing, setComposing] = useState(false);
  const [connecting, setConnecting] = useState<OAuthPlatform | null>(null);

  const refresh = useCallback(async () => {
    const r = await api('state', 'GET');
    if (r.ok && r.data) setS(r.data);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [refresh]);

  async function run(path: string, method: string, body?: unknown): Promise<boolean> {
    setBusy(true);
    setError(null);
    const r = await api(path, method, body);
    setBusy(false);
    if (r.ok && r.data) {
      setS(r.data);
      return true;
    }
    setError(r.error?.reason === 'needs_plan' ? 'plan' : 'action');
    return false;
  }

  /** Platform sign-in in this same tab (the app never opens windows):
   *  consent is recorded and the sign-in armed, then the browser goes to
   *  oauth/start; the platform brings it back to this screen with
   *  ?connected= or ?connect_error= (envivo-bff.ts). */
  async function connect(p: OAuthPlatform): Promise<boolean> {
    const r = await fetch('/api/tools/chalybobs/oauth/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: p, locale: document.documentElement.lang || 'es' }),
    })
      .then((x) => x.json() as Promise<{ ok: boolean; data?: { start: string } }>)
      .catch(() => ({ ok: false }) as { ok: boolean; data?: { start: string } });
    if (!r.ok || !r.data) return false;
    window.location.assign(r.data.start);
    return true;
  }

  const used = new Set(s.destinations.map((d) => d.platformId));
  const addable = PLATFORM_IDS.filter((p) => PLATFORM_META[p].supportsBroadcast && !used.has(p));
  const canConnect = (p: PlatformId): p is OAuthPlatform =>
    isOAuthPlatform(p) && s.oauthAvailable[p] === true;
  const active = s.destinations.filter((d) => d.enabled).length;
  const clipsOn = s.clipsEnabled && s.isFullAccess;

  return (
    <div className="ch-ev">
      {notice && (
        <div className={`ch-ev-notice ch-ev-notice--${notice.kind}`} role="status">
          <span>{noticeText(notice)}</span>
          <button type="button" aria-label={tn('close')} onClick={() => setNotice(null)}>
            <X aria-hidden="true" />
          </button>
        </div>
      )}

      <header className="ch-card ch-ev-head">
        <span className={`ch-ev-status${s.isLive ? ' ch-ev-status--live' : ''}`} role="status">
          <span className="ch-ev-status__dot" aria-hidden="true" />
          {s.isLive ? t('live') : t('offline')}
        </span>
        {editingTitle ? (
          <form
            className="ch-ev-title-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run('session', 'PATCH', { title: titleDraft.trim() }))
                setEditingTitle(false);
            }}
          >
            <label htmlFor="ev-title" className="ch-ev-key__l">
              {t('titleLabel')}
            </label>
            <input
              id="ev-title"
              className="ch-input"
              value={titleDraft}
              maxLength={200}
              autoFocus
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditingTitle(false);
              }}
            />
            <div className="ch-ev-form__btns">
              <button
                type="button"
                className="ch-btn ch-btn--gray ch-btn--compact"
                onClick={() => setEditingTitle(false)}
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="ch-btn ch-btn--primary ch-btn--compact"
                disabled={busy}
              >
                {t('save')}
              </button>
            </div>
          </form>
        ) : (
          <div className="ch-ev-title">
            <h2 className="ch-h2">{s.title}</h2>
            <button
              type="button"
              className="ch-btn ch-btn--gray ch-btn--compact"
              onClick={() => {
                setTitleDraft(s.title);
                setEditingTitle(true);
              }}
            >
              <Pencil aria-hidden="true" />
              {t('editTitle')}
            </button>
          </div>
        )}
        <p className="ch-muted">{s.isLive ? t('liveNote') : t('offlineNote')}</p>
      </header>

      {error && (
        <p role="alert" className="ch-ev-err">
          {error === 'plan' ? t('needsPlan') : t('actionError')}
        </p>
      )}

      <div className="ch-ev-grid">
        <div className="ch-ev-main">
          <StreamPreview
            initialUrl={s.previewEnabled ? previewUrl : null}
            offline={<EncoderCard rtmpUrl={s.rtmpUrl} next="/app/en-vivo" />}
          />
          <section className="ch-card ch-ev-clips" aria-labelledby="ev-clips">
            <span className="ch-ev-clips__ic" aria-hidden="true">
              <Scissors />
            </span>
            <div className="ch-ev-clips__tx">
              <b id="ev-clips">{t('clips')}</b>
              <span className="ch-muted">
                {!s.isFullAccess ? t('clipsLocked') : clipsOn ? t('clipsOn') : t('clipsOff')}
              </span>
            </div>
            {s.isFullAccess ? (
              <Switch
                checked={clipsOn}
                label={t('clips')}
                disabled={busy}
                onChange={(v) => void run('session', 'PATCH', { clipsEnabled: v })}
              />
            ) : (
              <Link
                href={'/app/planes' as Route}
                className="ch-btn ch-btn--secondary ch-btn--compact"
              >
                {t('clipsLockedCta')}
              </Link>
            )}
          </section>
        </div>

        <section className="ch-card ch-ev-ch" aria-labelledby="ev-ch">
          <div className="ch-ev-ch__head">
            <h2 id="ev-ch" className="ch-h3">
              {tc('title')}
            </h2>
            <span className="ch-muted">
              {tc('count', { activos: active, total: s.destinations.length })}
            </span>
          </div>
          <div className="ch-ev-ch__btns">
            <button
              type="button"
              className="ch-btn ch-btn--gray ch-btn--compact"
              disabled={busy || addable.length === 0}
              aria-expanded={picking}
              onClick={() => setPicking((v) => !v)}
            >
              <Plus aria-hidden="true" />
              {tc('add')}
            </button>
            <button
              type="button"
              className="ch-btn ch-btn--gray ch-btn--compact"
              disabled={busy}
              onClick={() => setComposing(true)}
            >
              <Pencil aria-hidden="true" />
              {tc('titles')}
            </button>
          </div>
          {picking && (
            <div className="ch-ev-pick" role="group" aria-label={tc('pick')}>
              <b>{tc('pick')}</b>
              {addable.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="ch-ev-pick__opt"
                  disabled={busy}
                  onClick={() => {
                    setPicking(false);
                    if (canConnect(p)) setConnecting(p);
                    else void run('destinations', 'POST', { platformId: p });
                  }}
                >
                  <i style={{ background: PLATFORM_META[p].color }} aria-hidden="true" />
                  <span>{PLATFORM_META[p].name}</span>
                  {canConnect(p) && <small>{tc('oneClick')}</small>}
                </button>
              ))}
            </div>
          )}
          {s.destinations.length === 0 ? (
            <p className="ch-muted ch-ev-ch__empty">
              <Radio aria-hidden="true" />
              {tc('empty')}
            </p>
          ) : (
            <ul className="ch-ev-list">
              {s.destinations.map((d) => {
                const meta = PLATFORM_META[d.platformId];
                const name = d.channelHandle || meta.name;
                const ready = destinationConfigured(d);
                const oauth = canConnect(d.platformId) ? d.platformId : null;
                return (
                  <li key={d.id} className="ch-ev-dest">
                    <div className="ch-ev-dest__row">
                      <span className="ch-ev-dest__av" aria-hidden="true">
                        {(name.trim()[0] ?? '?').toUpperCase()}
                        <i style={{ background: meta.color }} />
                      </span>
                      <span className="ch-ev-dest__tx">
                        <b>{name}</b>
                        <small>{d.streamTitle || meta.name}</small>
                        <small className={ready ? 'ch-ev-ok-t' : 'ch-ev-warn-t'}>
                          {d.oauthConnected ? tc('auto') : ready ? tc('ready') : tc('missingKey')}
                        </small>
                      </span>
                      <Switch
                        checked={d.enabled}
                        label={tc('toggle', { canal: name })}
                        disabled={busy || (!d.enabled && !ready)}
                        onChange={() =>
                          void run(`destinations/${encodeURIComponent(d.id)}/toggle`, 'POST', {})
                        }
                      />
                    </div>
                    {!ready && !d.enabled && (
                      <p className="ch-muted ch-ev-dest__note">{tc('needsKey')}</p>
                    )}
                    <div className="ch-ev-dest__acts">
                      {oauth && !d.oauthConnected && (
                        <button
                          type="button"
                          className="ch-btn ch-btn--secondary ch-btn--compact"
                          onClick={() => setConnecting(oauth)}
                        >
                          {tc('connect')}
                        </button>
                      )}
                      <button
                        type="button"
                        className="ch-btn ch-btn--gray ch-btn--compact"
                        disabled={busy}
                        onClick={() => setEditing(d)}
                      >
                        {tc('edit')}
                      </button>
                      <button
                        type="button"
                        className="ch-btn ch-btn--gray ch-btn--compact"
                        disabled={busy}
                        onClick={() => setRemoving(d)}
                      >
                        {tc('remove')}
                      </button>
                    </div>
                    {d.status?.kind === 'expired' && (
                      <p className="ch-ev-alert" role="alert">
                        <TriangleAlert aria-hidden="true" />
                        <span>{tc('expired', { plataforma: meta.name })}</span>
                        {oauth && (
                          <button
                            type="button"
                            className="ch-lnk"
                            onClick={() => setConnecting(oauth)}
                          >
                            {tc('reconnect')}
                          </button>
                        )}
                      </p>
                    )}
                    {d.status?.kind === 'pending_approval' && (
                      <p className="ch-ev-alert" role="alert">
                        <TriangleAlert aria-hidden="true" />
                        <span>
                          {tc('pending', { plataforma: d.status.platformName || meta.name })}
                        </span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {editing && (
        <ChannelEdit
          d={editing}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            if (await run(`destinations/${encodeURIComponent(editing.id)}`, 'PATCH', patch))
              setEditing(null);
          }}
        />
      )}
      {composing && (
        <BroadcastComposer
          // The title edited above is the broadcast title too (engine dashboard).
          meta={{ ...s.broadcastMeta, title: s.title }}
          platforms={s.destinations.map((d) => d.platformId)}
          busy={busy}
          onClose={() => setComposing(false)}
          onPublish={async (meta) => {
            if (await run('broadcast', 'POST', { meta })) {
              setComposing(false);
              setTitleDraft(meta.title);
            }
          }}
        />
      )}
      <Sheet
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={tc('removeTitle', {
          canal: removing ? removing.channelHandle || PLATFORM_META[removing.platformId].name : '',
        })}
        closeLabel={tc('close')}
      >
        <p className="ch-muted">{tc('removeBody')}</p>
        <div className="ch-ev-form__btns">
          <button type="button" className="ch-btn ch-btn--gray" onClick={() => setRemoving(null)}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className="ch-btn ch-btn--danger"
            disabled={busy}
            onClick={async () => {
              const d = removing;
              if (d && (await run(`destinations/${encodeURIComponent(d.id)}`, 'DELETE')))
                setRemoving(null);
            }}
          >
            {tc('removeYes')}
          </button>
        </div>
      </Sheet>
      <ConnectAccountSheet
        open={connecting !== null}
        platformName={connecting ? PLATFORM_META[connecting].name : ''}
        onClose={() => setConnecting(null)}
        onConnect={() => (connecting ? connect(connecting) : Promise.resolve(false))}
      />
    </div>
  );
}
