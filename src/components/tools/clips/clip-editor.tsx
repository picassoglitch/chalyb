'use client';

// Detalle del clip (TOOLS-SPEC §4.2, mockup 51): edit and download in one
// screen. Every change saves on its own (PATCH through the BFF) and the
// original is never deleted. "Descargar" is the only primary button; it
// waits ("Preparando tu descarga…") while a change is still saving, so the
// file always has the changes. Downloads stay in the same tab.

import { useEffect, useRef, useState } from 'react';
import { Check, Download, Pencil, Subtitles } from 'lucide-react';
import type { ClipDetail, ClipFormat, ClipPatch, ClipTrim } from '@/lib/tools/adapters/types';
import { CLIP_FORMATS } from '@/lib/tools/adapters/types';
import { mmss, TITLE_MAX, thumbFor } from '@/lib/tools/clips-home';
import { Switch } from '@/components/ui/switch';
import { Markup } from '@/components/ui/markup';
import { ShareButton } from '@/components/app/clips/share-button';
import { TrimBar } from './trim-bar';

export interface EditorCopy {
  title: string;
  titleHint: string;
  captions: string;
  captionsSub: string;
  captionSample: string;
  trim: string;
  trimHint: string;
  trimStart: string;
  trimLength: string;
  trimEnd: string;
  trimStartHandle: string;
  trimEndHandle: string;
  format: string;
  formats: Record<ClipFormat, string>;
  download: string;
  preparing: string;
  share: string;
  copied: string;
  autosave: string;
  saving: string;
  saved: string;
  saveError: string;
  player: string;
}

type Status = 'idle' | 'saving' | 'saved' | 'error';

export function ClipEditor({
  clip: initial,
  copy,
  publish,
}: {
  clip: ClipDetail;
  copy: EditorCopy;
  /** "Publicar en TikTok" (connected) or the connect flow, from the page. */
  publish?: React.ReactNode;
}) {
  const [clip, setClip] = useState(initial);
  const [title, setTitle] = useState(initial.title);
  const [status, setStatus] = useState<Status>('idle');
  const pending = useRef<ClipPatch>({});
  const timer = useRef<number | null>(null);

  async function flush() {
    timer.current = null;
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length === 0) return;
    setStatus('saving');
    try {
      const res = await fetch(`/api/tools/chalybclip/clips/${encodeURIComponent(clip.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = (await res.json()) as { ok: boolean; data?: ClipDetail };
      if (!json.ok || !json.data) throw new Error(String(res.status));
      setClip(json.data);
      setStatus(timer.current ? 'saving' : 'saved');
    } catch {
      setStatus('error');
    }
  }

  function save(patch: ClipPatch, now = false) {
    pending.current = { ...pending.current, ...patch };
    setStatus('saving');
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, now ? 0 : 600);
  }

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const setTrim = (trim: ClipTrim) => {
    setClip((c) => ({ ...c, trim }));
    save({ trim });
  };
  const length = clip.trim.endS - clip.trim.startS;
  const busy = status === 'saving';

  return (
    <div className="ch-clipedit">
      <div className={`ch-player ch-player--${clip.format}`}>
        {clip.previewUrl ? (
          <video
            src={clip.previewUrl}
            controls
            playsInline
            preload="metadata"
            aria-label={copy.player}
            className="ch-player__media"
          />
        ) : (
          <div
            className="ch-player__media"
            role="img"
            aria-label={copy.player}
            style={{ background: thumbFor(clip.id) }}
          >
            {clip.captionsOn && <span className="ch-player__cap">{copy.captionSample}</span>}
            <span className="ch-player__len">{mmss(length)}</span>
          </div>
        )}
      </div>

      <div className="ch-clipedit__side">
        <div className="ch-field">
          <div className="ch-clipedit__lbl">
            <label htmlFor="clip-title">
              <b>{copy.title}</b>
            </label>
            <span className="ch-muted">{copy.titleHint}</span>
          </div>
          <div className="ch-clipedit__title">
            <input
              id="clip-title"
              className="ch-input"
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => {
                setTitle(e.target.value);
                if (e.target.value.trim()) save({ title: e.target.value });
              }}
              onBlur={() => {
                if (!title.trim()) setTitle(clip.title);
              }}
            />
            <Pencil aria-hidden="true" />
          </div>
        </div>

        <div className="ch-card ch-clipedit__row">
          <span className="ch-clipedit__ic" aria-hidden="true">
            <Subtitles />
          </span>
          <span className="ch-clipedit__rowtx">
            <b id="cap-l">{copy.captions}</b>
            <span className="ch-muted">{copy.captionsSub}</span>
          </span>
          <Switch
            checked={clip.captionsOn}
            label={copy.captions}
            onChange={(v) => {
              setClip((c) => ({ ...c, captionsOn: v }));
              save({ captionsOn: v }, true);
            }}
          />
        </div>

        <div className="ch-card ch-clipedit__block">
          <div className="ch-clipedit__lbl">
            <b>{copy.trim}</b>
            <span className="ch-muted">{copy.trimHint}</span>
          </div>
          <TrimBar
            trim={clip.trim}
            durationS={clip.sourceDurationSec}
            onChange={setTrim}
            labels={{ start: copy.trimStartHandle, end: copy.trimEndHandle }}
          />
          <div className="ch-trim__times">
            <span>
              <Markup text={copy.trimStart.replace('{t}', mmss(clip.trim.startS))} />
            </span>
            <span>
              <Markup text={copy.trimLength.replace('{t}', mmss(length))} />
            </span>
            <span>
              <Markup text={copy.trimEnd.replace('{t}', mmss(clip.trim.endS))} />
            </span>
          </div>
        </div>

        <fieldset className="ch-card ch-clipedit__row ch-clipedit__fmt">
          <legend className="ch-sr">{copy.format}</legend>
          <b aria-hidden="true">{copy.format}</b>
          <div className="ch-fmtseg">
            {CLIP_FORMATS.map((f) => (
              <label key={f}>
                <input
                  type="radio"
                  name="clip-format"
                  value={f}
                  checked={clip.format === f}
                  onChange={() => {
                    setClip((c) => ({ ...c, format: f }));
                    save({ format: f }, true);
                  }}
                />
                <span>
                  <i className={`ch-fmtseg__shape ch-fmtseg__shape--${f}`} aria-hidden="true" />
                  {copy.formats[f]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {busy ? (
          <button
            type="button"
            className="ch-btn ch-btn--primary ch-btn--xl ch-clipedit__dl"
            disabled
            aria-live="polite"
          >
            {copy.preparing}
          </button>
        ) : (
          <a
            href={clip.downloadUrl}
            download
            className="ch-btn ch-btn--primary ch-btn--xl ch-clipedit__dl"
          >
            <Download aria-hidden="true" />
            {copy.download}
          </a>
        )}
        <div className="ch-clipedit__second">
          <ShareButton
            url={clip.downloadUrl}
            title={clip.title}
            label={copy.share}
            copiedLabel={copy.copied}
          />
          {publish}
        </div>
        <p className="ch-muted ch-clipedit__note" role="status">
          <Check aria-hidden="true" />
          {status === 'saving'
            ? copy.saving
            : status === 'error'
              ? copy.saveError
              : status === 'saved'
                ? `${copy.saved} · ${copy.autosave}`
                : copy.autosave}
        </p>
      </div>
    </div>
  );
}
