'use client';

// Where the network's sign-in sends the person back after connecting an
// account (/app/clips/publicar/conectado): straight back to the Publish
// Center. Facebook first asks which Page to connect: that picker is ours
// too, so the person never sees the publishing vendor's UI.
//
// The one-time `tempToken` arrives in the query string (the vendor's
// redirect); it is read once, removed from the address bar, and only ever
// sent in a POST body.

import { useEffect, useState } from 'react';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { publishApi, usePublishErrorText } from './api';

interface FbPage {
  page_id: string;
  name: string;
  category?: string | null;
}

/** Back to an /app/clips screen (the Publish Center by default), telling it
 *  which network just connected. */
function safeNext(raw: string | null, platform: string): string {
  const path = raw && /^\/app\/clips(\/[\w-]*)*$/.test(raw) ? raw : '/app/clips/publicar';
  return /^[a-z]{1,20}$/.test(platform)
    ? `${path}?conectado=${encodeURIComponent(platform)}`
    : path;
}

export interface ConnectedParams {
  platform: string;
  tempToken: string;
  userProfile: string;
  accountId: string;
  next: string | null;
}

export function ConnectedLanding({ params }: { params: ConnectedParams }) {
  const t = useTranslations('clipsPublish.connected');
  const errText = usePublishErrorText();
  const router = useRouter();
  const platform = params.platform.toLowerCase();
  const pick = platform === 'facebook' && !!params.tempToken && !params.accountId;
  const next = safeNext(params.next, platform);
  const [pages, setPages] = useState<FbPage[] | null>(null);
  const [picked, setPicked] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Drop the one-time token from the address bar and history.
    window.history.replaceState(null, '', window.location.pathname);
    if (!pick) {
      router.replace(next as Route);
      return;
    }
    let live = true;
    void publishApi<{ ok: boolean; pages: FbPage[] }>('fb-pages', {
      body: { temp_token: params.tempToken },
    }).then((r) => {
      if (!live) return;
      if (!r.ok) {
        setErr(errText(r.error));
        setPages([]);
        return;
      }
      setPages(r.data.pages ?? []);
      setPicked(r.data.pages?.[0]?.page_id ?? '');
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on landing
  }, []);

  if (!pick)
    return (
      <div className="ch-card ch-state" role="status">
        <h2 className="ch-h2">{t('done')}</h2>
        <p className="ch-muted">{t('back')}</p>
      </div>
    );

  return (
    <form
      className="ch-card ch-pub-sec"
      style={{ maxWidth: 520 }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!picked) return;
        setBusy(true);
        setErr(null);
        const r = await publishApi('fb-page/select', {
          body: {
            page_id: picked,
            temp_token: params.tempToken,
            user_profile_raw: params.userProfile,
          },
        });
        setBusy(false);
        if (!r.ok) {
          setErr(errText(r.error));
          return;
        }
        router.replace(next as Route);
      }}
    >
      <header>
        <h2>{t('fbTitle')}</h2>
      </header>
      <p className="ch-muted">{t('fbBody')}</p>
      {pages === null ? (
        <p className="ch-pub-hint">{t('fbLoading')}</p>
      ) : pages.length === 0 ? (
        !err && <p className="ch-pub-hint">{t('fbNone')}</p>
      ) : (
        <fieldset className="ch-pub-stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="ch-sr">{t('fbTitle')}</legend>
          {pages.map((pg) => (
            <label key={pg.page_id} className="ch-card ch-opt">
              <input
                type="radio"
                name="fb-page"
                value={pg.page_id}
                checked={picked === pg.page_id}
                onChange={() => setPicked(pg.page_id)}
              />
              <span>
                {pg.name}
                {pg.category && <small className="ch-muted"> · {pg.category}</small>}
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {err && (
        <p className="ch-pub-err" role="alert">
          {err}
        </p>
      )}
      <button
        type="submit"
        className="ch-btn ch-btn--primary ch-btn--compact"
        disabled={busy || !picked}
      >
        {t('fbCta')}
      </button>
    </form>
  );
}
