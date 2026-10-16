'use client';

// Clips · Tu estilo (a brand kit, mode "a"): accounts, caption style, the
// phrases that cut clips (forward / backward), safe scheduling, the Clips end
// card (paid plans can turn it off) and an AI-made logo. Save, make default,
// delete.

import { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { errorText, toolCall, ToolCallError, type ErrorCopy } from './tool-call';

export interface KitValues {
  name: string;
  handle_tiktok: string;
  handle_youtube: string;
  handle_instagram: string;
  handle_kick: string;
  caption_preset: string;
  forward_phrases: string;
  retroactive_phrases: string;
  safe_schedule_enabled: boolean;
  content_timezone: string;
  safety_preset: string;
  show_chalybclip_outro: boolean;
  is_default: boolean;
}

export interface KitCopy {
  identity: string;
  name: string;
  namePh: string;
  makeDefaultNew: string;
  accounts: string;
  captions: string;
  captionsHint: string;
  presets: Record<string, string>;
  phrases: string;
  phrasesHint: string;
  forward: string;
  forwardHint: string;
  backward: string;
  backwardHint: string;
  onePerLine: string;
  safe: string;
  safeOn: string;
  safeHint: string;
  timezone: string;
  howOften: string;
  safety: Record<string, string>;
  outro: string;
  outroOn: string;
  outroFree: string;
  logo: string;
  logoHint: string;
  logoStyle: string;
  logoStylePh: string;
  logoGo: string;
  logoWorking: string;
  logoAlt: string;
  logoSaveFirst: string;
  logoFailed: string;
  create: string;
  save: string;
  saved: string;
  makeDefault: string;
  isDefault: string;
  remove: string;
  removeConfirm: string;
  working: string;
  errors: ErrorCopy;
}

const lines = (s: string) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

export function KitForm({
  kitId,
  initial,
  presets,
  freeTier,
  logoSvg,
  copy,
}: {
  kitId: string | null;
  initial: KitValues;
  presets: string[];
  freeTier: boolean;
  logoSvg: string | null;
  copy: KitCopy;
}) {
  const router = useRouter();
  const [v, setV] = useState<KitValues>(() => {
    if (initial.content_timezone && initial.content_timezone !== 'UTC') return initial;
    // Like the old page: the timezone comes from the browser, never typed.
    let tz = initial.content_timezone || 'UTC';
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz;
    } catch {}
    return { ...initial, content_timezone: tz };
  });
  const [logo, setLogo] = useState(logoSvg);
  const [style, setStyle] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof KitValues>(k: K, val: KitValues[K]) =>
    setV((x) => ({ ...x, [k]: val }));

  async function run(name: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(name);
    setMsg(null);
    try {
      await fn();
    } catch (err) {
      const logoFailed = err instanceof ToolCallError && err.refusal === 'logo_failed';
      setMsg({ ok: false, text: logoFailed ? copy.logoFailed : errorText(err, copy.errors) });
    } finally {
      setBusy(null);
    }
  }

  const body = () => ({
    ...v,
    forward_phrases: lines(v.forward_phrases),
    retroactive_phrases: lines(v.retroactive_phrases),
    show_chalybclip_outro: freeTier ? true : v.show_chalybclip_outro,
  });

  return (
    <form
      className="ch-ce-stack"
      onSubmit={(e) => {
        e.preventDefault();
        void run('save', async () => {
          if (kitId) {
            await toolCall(`/brand-kits/${encodeURIComponent(kitId)}`, 'PUT', body());
            setMsg({ ok: true, text: copy.saved });
            router.refresh();
          } else {
            const r = await toolCall<{ kit: { id: string } }>('/brand-kits', 'POST', body());
            router.push(`/app/clips/ajustes/estilos/${encodeURIComponent(r.kit.id)}`);
          }
        });
      }}
    >
      <section className="ch-card ch-ce-card" aria-labelledby="k-id">
        <h2 id="k-id" className="ch-h3">
          {copy.identity}
        </h2>
        <label className="ch-ce-field">
          {copy.name}
          <input
            className="ch-input"
            required
            maxLength={120}
            value={v.name}
            placeholder={copy.namePh}
            onChange={(e) => set('name', e.target.value)}
          />
        </label>
        {!kitId && (
          <label className="ch-ce-check">
            <input
              type="checkbox"
              checked={v.is_default}
              onChange={(e) => set('is_default', e.target.checked)}
            />
            <span>{copy.makeDefaultNew}</span>
          </label>
        )}
      </section>

      <section className="ch-card ch-ce-card" aria-labelledby="k-acc">
        <h2 id="k-acc" className="ch-h3">
          {copy.accounts}
        </h2>
        <div className="ch-ce-grid2">
          {(['tiktok', 'youtube', 'instagram', 'kick'] as const).map((p) => (
            <label key={p} className="ch-ce-field">
              {{ tiktok: 'TikTok', youtube: 'YouTube', instagram: 'Instagram', kick: 'Kick' }[p]}
              <input
                className="ch-input"
                maxLength={100}
                placeholder="@"
                value={v[`handle_${p}`]}
                onChange={(e) => set(`handle_${p}`, e.target.value)}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="ch-card ch-ce-card" aria-labelledby="k-cap">
        <h2 id="k-cap" className="ch-h3">
          {copy.captions}
        </h2>
        <p className="ch-ce-note">{copy.captionsHint}</p>
        <select
          className="ch-select"
          aria-label={copy.captions}
          value={v.caption_preset}
          onChange={(e) => set('caption_preset', e.target.value)}
        >
          {presets.map((p) => (
            <option key={p} value={p}>
              {copy.presets[p] ?? p}
            </option>
          ))}
        </select>
      </section>

      <section className="ch-card ch-ce-card" aria-labelledby="k-ph">
        <h2 id="k-ph" className="ch-h3">
          {copy.phrases}
        </h2>
        <p className="ch-ce-note">{copy.phrasesHint}</p>
        <div className="ch-ce-grid2">
          <label className="ch-ce-field">
            {copy.forward}
            <small>{copy.forwardHint}</small>
            <textarea
              className="ch-input"
              value={v.forward_phrases}
              placeholder={copy.onePerLine}
              onChange={(e) => set('forward_phrases', e.target.value)}
            />
          </label>
          <label className="ch-ce-field">
            {copy.backward}
            <small>{copy.backwardHint}</small>
            <textarea
              className="ch-input"
              value={v.retroactive_phrases}
              placeholder={copy.onePerLine}
              onChange={(e) => set('retroactive_phrases', e.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="ch-card ch-ce-card" aria-labelledby="k-safe">
        <h2 id="k-safe" className="ch-h3">
          {copy.safe}
        </h2>
        <label className="ch-ce-check">
          <input
            type="checkbox"
            checked={v.safe_schedule_enabled}
            onChange={(e) => set('safe_schedule_enabled', e.target.checked)}
          />
          <span>
            {copy.safeOn}
            <small>{copy.safeHint}</small>
          </span>
        </label>
        <p className="ch-ce-note">
          {copy.timezone} <b>{v.content_timezone}</b>
        </p>
        <label className="ch-ce-field">
          {copy.howOften}
          <select
            className="ch-select"
            value={v.safety_preset}
            onChange={(e) => set('safety_preset', e.target.value)}
          >
            {Object.entries(copy.safety).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="ch-card ch-ce-card" aria-labelledby="k-out">
        <h2 id="k-out" className="ch-h3">
          {copy.outro}
        </h2>
        {freeTier ? (
          <p className="ch-ce-note">{copy.outroFree}</p>
        ) : (
          <label className="ch-ce-check">
            <input
              type="checkbox"
              checked={v.show_chalybclip_outro}
              onChange={(e) => set('show_chalybclip_outro', e.target.checked)}
            />
            <span>{copy.outroOn}</span>
          </label>
        )}
      </section>

      <section className="ch-card ch-ce-card" aria-labelledby="k-logo">
        <h2 id="k-logo" className="ch-h3">
          {copy.logo}
        </h2>
        <p className="ch-ce-note">{copy.logoHint}</p>
        {logo && (
          <span className="ch-ce-logo">
            {/* Sanitized SVG from the engine, shown as an image (no scripts run). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`data:image/svg+xml;utf8,${encodeURIComponent(logo)}`} alt={copy.logoAlt} />
          </span>
        )}
        {kitId ? (
          <div className="ch-ce-grid2">
            <label className="ch-ce-field">
              {copy.logoStyle}
              <input
                className="ch-input"
                maxLength={200}
                value={style}
                placeholder={copy.logoStylePh}
                onChange={(e) => setStyle(e.target.value)}
              />
            </label>
            <div className="ch-ce-actions" style={{ alignSelf: 'end' }}>
              <button
                type="button"
                className="ch-btn ch-btn--secondary"
                disabled={!!busy}
                onClick={() =>
                  run('logo', async () => {
                    const r = await toolCall<{ kit: { logo_svg: string | null } }>(
                      `/brand-kits/${encodeURIComponent(kitId)}/logo`,
                      'POST',
                      { style_hint: style },
                    );
                    setLogo(r.kit.logo_svg);
                  })
                }
              >
                {busy === 'logo' ? copy.logoWorking : copy.logoGo}
              </button>
            </div>
          </div>
        ) : (
          <p className="ch-ce-note">{copy.logoSaveFirst}</p>
        )}
      </section>

      {msg && (
        <p className={msg.ok ? 'ch-ce-ok' : 'ch-ce-err'} role={msg.ok ? 'status' : 'alert'}>
          {msg.text}
        </p>
      )}
      <div className="ch-ce-actions">
        <button type="submit" className="ch-btn ch-btn--primary" disabled={!!busy}>
          {busy === 'save' ? copy.working : kitId ? copy.save : copy.create}
        </button>
        {kitId && !initial.is_default && (
          <button
            type="button"
            className="ch-btn ch-btn--secondary"
            disabled={!!busy}
            onClick={() =>
              run('default', async () => {
                await toolCall(`/brand-kits/${encodeURIComponent(kitId)}/default`);
                router.refresh();
              })
            }
          >
            {copy.makeDefault}
          </button>
        )}
        {kitId && initial.is_default && (
          <span className="ch-pill ch-pill--ok">{copy.isDefault}</span>
        )}
        {kitId && (
          <button
            type="button"
            className="ch-btn ch-btn--gray"
            disabled={!!busy}
            onClick={() => {
              if (!window.confirm(copy.removeConfirm)) return;
              void run('delete', async () => {
                await toolCall(`/brand-kits/${encodeURIComponent(kitId)}`, 'DELETE');
                router.push('/app/clips/ajustes/estilos');
              });
            }}
          >
            {copy.remove}
          </button>
        )}
      </div>
    </form>
  );
}
