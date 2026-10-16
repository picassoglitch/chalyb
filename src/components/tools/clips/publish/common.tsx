'use client';

// Small pieces every Publish Center tab uses: platform tiles, the clip
// thumbnail, a confirm sheet, an inline status line and date formatting.

import { useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Film } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';

const NAMES: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  twitter: 'X',
  x: 'X',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  threads: 'Threads',
  pinterest: 'Pinterest',
  bluesky: 'Bluesky',
  discord: 'Discord',
  telegram: 'Telegram',
};

export function platformName(id: string): string {
  return NAMES[id.toLowerCase()] ?? id;
}

/** A coloured letter tile for a platform (brand names never translate). */
export function PlatformTile({ id, small }: { id: string; small?: boolean }) {
  const key = id.toLowerCase();
  const name = platformName(key);
  return (
    <span
      className={`ch-pub-plat ch-pub-plat--${key}${small ? ' ch-pub-plat--sm' : ''}`}
      aria-hidden="true"
    >
      {name.slice(0, 1)}
    </span>
  );
}

export function PlatformList({ ids }: { ids: string[] }) {
  if (ids.length === 0) return null;
  return (
    <span className="ch-pub-plats" aria-label={ids.map(platformName).join(', ')}>
      {ids.map((p) => (
        <PlatformTile key={p} id={p} small />
      ))}
    </span>
  );
}

/** The clip's thumbnail through the BFF; a film icon when there is none. */
export function ClipThumb({ clipId, durationS }: { clipId: string | null; durationS?: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="ch-pub-thumb">
      {clipId && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- private, per-user image from the BFF
        <img
          src={`/api/tools/chalybclip/publish/clips/${encodeURIComponent(clipId)}/thumbnail`}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <Film aria-hidden="true" />
      )}
      {durationS !== undefined && (
        <span className="ch-pub-thumb__dur">{Math.round(durationS)}s</span>
      )}
    </span>
  );
}

/** Engine timestamps are ISO, sometimes without a zone (UTC). */
export function parseWhen(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  let s = String(iso);
  if (!/(?:[zZ]|[+-]\d\d:?\d\d)$/.test(s)) s += 'Z';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function useFormatWhen(): (iso: string | null | undefined) => string {
  const locale = useLocale();
  return (iso) => {
    const d = parseWhen(iso);
    if (!d) return '—';
    return d.toLocaleString(locale === 'en' ? 'en' : 'es-MX', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
}

/** `datetime-local` value for a Date, in the person's own time zone. */
export function toLocalInput(d: Date): string {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export type Msg = { kind: 'ok' | 'bad' | 'info'; text: string } | null;

export function InlineMsg({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <span
      className={`ch-pub-msg${msg.kind === 'ok' ? ' ch-pub-msg--ok' : msg.kind === 'bad' ? ' ch-pub-msg--bad' : ''}`}
      role={msg.kind === 'bad' ? 'alert' : 'status'}
    >
      {msg.text}
    </span>
  );
}

export interface ConfirmRequest {
  title: string;
  body?: ReactNode;
  cta: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}

/** One confirm sheet per screen: `ask({...})` opens it. */
export function useConfirm(): [(req: ConfirmRequest) => void, ReactNode] {
  const t = useTranslations('clipsPublish.common');
  const [req, setReq] = useState<ConfirmRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const node = (
    <Sheet
      open={!!req}
      onClose={() => !busy && setReq(null)}
      title={req?.title ?? ''}
      closeLabel={t('close')}
    >
      {req && (
        <div style={{ display: 'grid', gap: 18 }}>
          {req.body && <p>{req.body}</p>}
          <div className="ch-pub-row">
            <button
              type="button"
              className={`ch-btn ch-btn--compact ${req.danger ? 'ch-btn--danger' : 'ch-btn--primary'}`}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await req.onConfirm();
                } finally {
                  setBusy(false);
                  setReq(null);
                }
              }}
            >
              {req.cta}
            </button>
            <button
              type="button"
              className="ch-btn ch-btn--compact ch-btn--gray"
              disabled={busy}
              onClick={() => setReq(null)}
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
  return [setReq, node];
}
