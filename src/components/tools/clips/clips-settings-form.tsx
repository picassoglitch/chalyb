'use client';

// Ajustes de Clips (TOOLS-SPEC §4.3, mockup 52). Every control saves on its
// own and applies to the next clips. Rows exist only for what the engine
// can do (capabilities); the page decides which.

import { useState } from 'react';
import { Check, Globe, Stamp, Subtitles } from 'lucide-react';
import type { CaptionPreset, ClipsSettings } from '@/lib/tools/adapters/types';
import { CAPTION_PRESETS } from '@/lib/tools/adapters/types';
import { Switch } from '@/components/ui/switch';

export interface SettingsCopy {
  captions: string;
  captionsOn: string;
  captionLang: string;
  langs: Record<'es' | 'en', string>;
  style: string;
  styleHint: string;
  presets: Record<CaptionPreset, string>;
  sample: string;
  brand: string;
  watermark: string;
  watermarkSub: string;
  saving: string;
  saveError: string;
}

export function ClipsSettingsForm({
  initial,
  copy,
  watermark,
}: {
  initial: ClipsSettings;
  copy: SettingsCopy;
  /** capabilities.watermark. "Subir mi logo" waits for an upload API in the
   *  adapter: no control without an action. */
  watermark: boolean;
}) {
  const [s, setS] = useState(initial);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  async function save(patch: Partial<ClipsSettings>) {
    const next = { ...s, ...patch };
    setS(next);
    setStatus('saving');
    try {
      const res = await fetch('/api/tools/chalybclip/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = (await res.json()) as { ok: boolean; data?: ClipsSettings };
      if (!json.ok || !json.data) throw new Error(String(res.status));
      setS(json.data);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }

  return (
    <>
      <section aria-labelledby="set-cap" className="ch-setgroup">
        <h2 id="set-cap" className="ch-ghead">
          {copy.captions}
        </h2>
        <ul className="ch-card ch-setlist">
          <li className="ch-setrow">
            <span className="ch-setrow__ic ch-setrow__ic--amber" aria-hidden="true">
              <Subtitles />
            </span>
            <span className="ch-setrow__tx">
              <b>{copy.captionsOn}</b>
            </span>
            <Switch checked={s.captionsOn} label={copy.captionsOn} onChange={(v) => save({ captionsOn: v })} />
          </li>
          <li className="ch-setrow">
            <span className="ch-setrow__ic ch-setrow__ic--blue" aria-hidden="true">
              <Globe />
            </span>
            <label className="ch-setrow__tx" htmlFor="cap-lang">
              <b>{copy.captionLang}</b>
            </label>
            <select
              id="cap-lang"
              className="ch-select"
              value={s.captionLang}
              onChange={(e) => save({ captionLang: e.target.value as 'es' | 'en' })}
            >
              {(['es', 'en'] as const).map((l) => (
                <option key={l} value={l}>
                  {copy.langs[l]}
                </option>
              ))}
            </select>
          </li>
        </ul>
      </section>

      <section aria-labelledby="set-style" className="ch-setgroup">
        <h2 id="set-style" className="ch-ghead">
          {copy.style}
        </h2>
        <fieldset className="ch-card ch-presets">
          <legend className="ch-muted">{copy.styleHint}</legend>
          <div className="ch-presets__row">
            {CAPTION_PRESETS.map((p) => (
              <label key={p} className="ch-preset">
                <input
                  type="radio"
                  name="caption-preset"
                  value={p}
                  checked={s.captionPreset === p}
                  onChange={() => save({ captionPreset: p })}
                />
                <span className={`ch-preset__frame ch-preset__frame--${p}`} aria-hidden="true">
                  <span className="ch-preset__cap">{copy.sample}</span>
                  <span className="ch-preset__ok">
                    <Check />
                  </span>
                </span>
                <span className="ch-preset__name">{copy.presets[p]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      {watermark && (
        <section aria-labelledby="set-brand" className="ch-setgroup">
          <h2 id="set-brand" className="ch-ghead">
            {copy.brand}
          </h2>
          <ul className="ch-card ch-setlist">
            <li className="ch-setrow">
              <span className="ch-setrow__ic ch-setrow__ic--pink" aria-hidden="true">
                <Stamp />
              </span>
              <span className="ch-setrow__tx">
                <b>{copy.watermark}</b>
                <span className="ch-muted">{copy.watermarkSub}</span>
              </span>
              <Switch checked={s.watermarkOn} label={copy.watermark} onChange={(v) => save({ watermarkOn: v })} />
            </li>
          </ul>
        </section>
      )}
      {status !== 'idle' && (
        <p className="ch-muted" role="status">
          {status === 'saving' ? copy.saving : copy.saveError}
        </p>
      )}
    </>
  );
}

/** "Duración de los clips" and "Encuadre" inside Opciones avanzadas. */
export function ClipsAdvancedFields({
  initial,
  duration,
  framing,
  copy,
}: {
  initial: ClipsSettings;
  duration: boolean;
  framing: boolean;
  copy: {
    duration: string;
    durationAuto: string;
    /** "{n} segundos" */
    durationFixed: string;
    framing: string;
    framingCenter: string;
    framingFollow: string;
  };
}) {
  const [s, setS] = useState(initial);
  async function save(patch: Partial<ClipsSettings>) {
    setS((x) => ({ ...x, ...patch }));
    await fetch('/api/tools/chalybclip/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => {});
  }
  return (
    <>
      {duration && (
        <div className="ch-setrow">
          <label className="ch-setrow__tx" htmlFor="adv-duration">
            <b>{copy.duration}</b>
          </label>
          <select
            id="adv-duration"
            className="ch-select"
            value={String(s.duration)}
            onChange={(e) => save({ duration: e.target.value === 'auto' ? 'auto' : Number(e.target.value) })}
          >
            <option value="auto">{copy.durationAuto}</option>
            {[15, 30, 45, 60].map((n) => (
              <option key={n} value={n}>
                {copy.durationFixed.replace('{n}', String(n))}
              </option>
            ))}
          </select>
        </div>
      )}
      {framing && (
        <div className="ch-setrow">
          <label className="ch-setrow__tx" htmlFor="adv-framing">
            <b>{copy.framing}</b>
          </label>
          <select
            id="adv-framing"
            className="ch-select"
            value={s.framing}
            onChange={(e) => save({ framing: e.target.value as ClipsSettings['framing'] })}
          >
            <option value="center">{copy.framingCenter}</option>
            <option value="follow">{copy.framingFollow}</option>
          </select>
        </div>
      )}
    </>
  );
}
