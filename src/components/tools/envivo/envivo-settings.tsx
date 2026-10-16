'use client';

// Ajustes de En vivo: the Clips connection (full-access plans) and the
// stream key — masked until "Mostrar", and "Generar una clave nueva" behind
// a confirmation (the old key stops working at once, like in the engine).

import { useState } from 'react';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import { BookOpen, KeyRound, RefreshCw, Scissors } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Sheet } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { fullRtmpUrl } from '@/lib/tools/envivo-platforms';
import type { LiveState } from '@/lib/tools/adapters/tools';
import { ReauthSheet, useKeyReveal, ValueRow } from './stream-key';

export function EnVivoSettings({ initial }: { initial: LiveState }) {
  const t = useTranslations('liveTool.settings');
  const tr = useTranslations('liveTool.room');
  const te = useTranslations('liveTool.encoder');
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'action' | 'plan' | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [regenerated, setRegenerated] = useState(false);
  const r = useKeyReveal('ingest');
  const clipsOn = s.clipsEnabled && s.isFullAccess;
  const secret = {
    shown: r.key !== null,
    busy: r.busy,
    onShow: () => void r.reveal(''),
    onHide: r.hide,
  };

  async function call(path: string, method: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tools/chalybobs/${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: unknown;
        error?: { reason?: string };
      };
      if (!json.ok) setError(json.error?.reason === 'needs_plan' ? 'plan' : 'action');
      return json;
    } catch {
      setError('action');
      return { ok: false } as { ok: boolean; data?: unknown };
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ch-ev-set">
      {error && (
        <p role="alert" className="ch-ev-err">
          {error === 'plan' ? tr('needsPlan') : t('saveError')}
        </p>
      )}
      <section aria-labelledby="set-clips">
        <h2 id="set-clips" className="ch-label ch-ev-set__h">
          {t('clips')}
        </h2>
        <div className="ch-card ch-ev-clips">
          <span className="ch-ev-clips__ic" aria-hidden="true">
            <Scissors />
          </span>
          <div className="ch-ev-clips__tx">
            <b>{tr('clips')}</b>
            <span className="ch-muted">
              {!s.isFullAccess ? tr('clipsLocked') : clipsOn ? tr('clipsOn') : tr('clipsOff')}
            </span>
          </div>
          {s.isFullAccess ? (
            <Switch
              checked={clipsOn}
              label={tr('clips')}
              disabled={busy}
              onChange={async (v) => {
                const res = await call('session', 'PATCH', { clipsEnabled: v });
                if (res.ok && res.data) setS(res.data as LiveState);
              }}
            />
          ) : (
            <Link
              href={'/app/planes' as Route}
              className="ch-btn ch-btn--secondary ch-btn--compact"
            >
              {tr('clipsLockedCta')}
            </Link>
          )}
        </div>
      </section>

      <section aria-labelledby="set-key">
        <h2 id="set-key" className="ch-label ch-ev-set__h">
          {t('keyTitle')}
        </h2>
        <div className="ch-card ch-ev-set__key">
          <p className="ch-ev-set__lock">
            <KeyRound aria-hidden="true" />
            {t('keyNote')}
          </p>
          <ValueRow id="set-server" label={te('server')} value={s.rtmpUrl} />
          <ValueRow id="set-key-v" label={t('key')} value={r.key} secret={secret} />
          <ValueRow
            id="set-full"
            label={te('full')}
            value={r.key === null ? null : fullRtmpUrl(s.rtmpUrl, r.key)}
            secret={secret}
            note={te('fullNote')}
          />
          {regenerated && (
            <p role="status" className="ch-ev-ok">
              {t('regenDone')}
            </p>
          )}
          <div className="ch-ev-form__btns">
            <button
              type="button"
              className="ch-btn ch-btn--gray ch-btn--compact"
              disabled={busy}
              onClick={() => setConfirm(true)}
            >
              <RefreshCw aria-hidden="true" />
              {t('regenerate')}
            </button>
            <Link href={'/app/en-vivo/conectar' as Route} className="ch-lnk ch-ev-enc__guide">
              <BookOpen aria-hidden="true" />
              {t('guide')}
            </Link>
          </div>
        </div>
      </section>

      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('regenTitle')}
        closeLabel={t('close')}
      >
        <p className="ch-muted">{t('regenBody')}</p>
        <div className="ch-ev-form__btns">
          <button type="button" className="ch-btn ch-btn--gray" onClick={() => setConfirm(false)}>
            {t('regenNo')}
          </button>
          <button
            type="button"
            className="ch-btn ch-btn--danger"
            disabled={busy}
            onClick={async () => {
              const res = await call('stream-key/regenerate', 'POST', {});
              setConfirm(false);
              if (res.ok) {
                r.hide();
                setRegenerated(true);
              }
            }}
          >
            {t('regenYes')}
          </button>
        </div>
      </Sheet>
      <ReauthSheet r={r} next="/app/en-vivo/ajustes" />
    </div>
  );
}
