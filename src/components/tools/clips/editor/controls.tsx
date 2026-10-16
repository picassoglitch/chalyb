'use client';

// The editor's controls, same order as the engine's editor:
//   0 ¿Dónde lo vas a subir? (one chip sets everything for that app)
//   · Estilo del clip   1 Hook viral   2 Subtítulos   3 Tu marca
// The numbered sections are an accordion: one open at a time.

import { useId, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowUpRight, ChevronDown, Sparkles } from 'lucide-react';
import type { EditorForm, EditorPayload, HookIdeas } from '@/lib/tools/adapters/clips/editor-types';
import { Markup } from '@/components/ui/markup';
import {
  BANNER_PLATFORMS,
  BANNER_VARIANTS,
  CAPTION_ANIMATIONS,
  CAPTION_SIZES,
  CLIP_STYLES,
  HOOK_TONES,
  TARGETS,
  type ClipStyleId,
  type HookTone,
  type TargetId,
} from './presets';

export type Section = 'style' | 'hook' | 'captions' | 'brand';

function Panel({
  id,
  step,
  title,
  sub,
  open,
  onToggle,
  children,
}: {
  id: Section;
  step: string;
  title: string;
  sub: string;
  open: boolean;
  onToggle: (id: Section) => void;
  children: ReactNode;
}) {
  const body = useId();
  return (
    <section className={`ch-card ch-ce__panel${open ? ' is-open' : ''}`}>
      <h3 className="ch-ce__panel-h">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={body}
          onClick={() => onToggle(id)}
        >
          <span className="ch-ce__step" aria-hidden="true">
            {step}
          </span>
          <span className="ch-ce__panel-t">
            <b>{title}</b>
            <span className="ch-muted">{sub}</span>
          </span>
          <ChevronDown className="ch-ce__chev" aria-hidden="true" />
        </button>
      </h3>
      <div id={body} className="ch-ce__panel-body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}

function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="ch-check ch-ce__check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  hint?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="ch-ce__field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        className="ch-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      {hint}
    </div>
  );
}

export function TargetPicker({
  value,
  onPick,
  flash,
}: {
  value: string;
  onPick: (t: TargetId) => void;
  flash: number;
}) {
  const t = useTranslations('clipsEditor.target');
  const cur = (TARGETS as readonly string[]).includes(value) ? (value as TargetId) : 'all';
  return (
    <section className="ch-card ch-ce__panel is-open ch-ce__target" aria-labelledby="ce-target">
      <h3 className="ch-ce__panel-h ch-ce__panel-h--static" id="ce-target">
        <span className="ch-ce__step" aria-hidden="true">
          0
        </span>
        <span className="ch-ce__panel-t">
          <b>{t('title')}</b>
          <span className="ch-muted">{t('sub')}</span>
        </span>
      </h3>
      <div className="ch-ce__panel-body">
        <div className="ch-ce__chips" role="radiogroup" aria-labelledby="ce-target">
          {TARGETS.map((id) => (
            <button
              // Re-mount the picked chip on every pick so its flash replays.
              key={cur === id ? `${id}:${flash}` : id}
              type="button"
              role="radio"
              aria-checked={cur === id}
              className={`ch-ce__chip${cur === id ? ' is-on' : ''}${cur === id && flash ? ' is-flash' : ''}`}
              onClick={() => onPick(id)}
              title={t(`blurb.${id}`)}
            >
              <b>{t(`name.${id}`)}</b>
            </button>
          ))}
        </div>
        <p className="ch-muted ch-ce__blurb" aria-live="polite">
          <Markup
            text={t.markup('readyFor', {
              plataforma: t(`name.${cur}`),
              blurb: t(`blurb.${cur}`),
              b: (c) => `<b>${c}</b>`,
            })}
          />
        </p>
      </div>
    </section>
  );
}

export function Controls({
  form,
  set,
  payload,
  open,
  onToggle,
  onStyle,
  onBannerPlatform,
  hooks,
}: {
  form: EditorForm;
  set: (patch: Partial<EditorForm>) => void;
  payload: EditorPayload;
  open: Section | null;
  onToggle: (s: Section) => void;
  onStyle: (s: ClipStyleId) => void;
  onBannerPlatform: (p: string) => void;
  hooks: {
    tone: HookTone;
    setTone: (t: HookTone) => void;
    run: () => void;
    state: 'idle' | 'busy' | 'error';
    result: HookIdeas | null;
  };
}) {
  const t = useTranslations('clipsEditor');
  const titleId = useId();
  const urlId = useId();
  const colorId = useId();
  const hlId = useId();
  const toneId = useId();
  const [flashTitle, setFlashTitle] = useState(false);
  const aiPos = payload.ai_decisions?.caption_position;
  const kitPreset = payload.caption_style?.preset || 'karaoke_pop';

  return (
    <>
      <Panel
        id="style"
        step="·"
        title={t('style.title')}
        sub={t('style.sub')}
        open={open === 'style'}
        onToggle={onToggle}
      >
        <div className="ch-ce__styles" role="radiogroup" aria-label={t('style.title')}>
          {CLIP_STYLES.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={form.clip_style === id}
              className={`ch-ce__style${form.clip_style === id ? ' is-on' : ''}`}
              onClick={() => onStyle(id)}
            >
              <b>{t(`style.name.${id}`)}</b>
              <span className="ch-muted">{t(`style.desc.${id}`)}</span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel
        id="hook"
        step="1"
        title={t('hook.title')}
        sub={t('hook.sub')}
        open={open === 'hook'}
        onToggle={onToggle}
      >
        <div className="ch-ce__field">
          <label htmlFor={titleId}>{t('hook.label')}</label>
          <textarea
            id={titleId}
            className={`ch-input ch-ce__textarea${flashTitle ? ' is-flash' : ''}`}
            rows={2}
            maxLength={500}
            value={form.title_text}
            placeholder={t('hook.placeholder')}
            onChange={(e) => set({ title_text: e.target.value })}
          />
          <p className="ch-muted ch-ce__hint">{t('hook.hint')}</p>
        </div>
        <div className="ch-ce__hookgen">
          <div className="ch-ce__field">
            <label htmlFor={toneId}>{t('hook.tone')}</label>
            <select
              id={toneId}
              className="ch-select"
              value={hooks.tone}
              onChange={(e) => hooks.setTone(e.target.value as HookTone)}
            >
              {HOOK_TONES.map((tone) => (
                <option key={tone} value={tone}>
                  {t(`hook.tones.${tone}`)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="ch-btn ch-btn--secondary ch-ce__gen"
            onClick={hooks.run}
            disabled={hooks.state === 'busy'}
          >
            <Sparkles aria-hidden="true" />
            {t('hook.generate')}
          </button>
        </div>
        <div className="ch-ce__hooks" aria-live="polite">
          {hooks.state === 'busy' ? (
            <p className="ch-muted">
              {t('hook.generating', { tono: t(`hook.tones.${hooks.tone}`) })}
            </p>
          ) : hooks.state === 'error' ? (
            <p className="ch-ce__flash ch-ce__flash--bad" role="alert">
              {t('hook.error')}
            </p>
          ) : hooks.result ? (
            hooks.result.hooks.length === 0 ? (
              <p className="ch-muted">{t('hook.none')}</p>
            ) : (
              <>
                {hooks.result.source === 'deterministic' ? (
                  <p className="ch-muted">{t('hook.fallback')}</p>
                ) : null}
                <ul>
                  {hooks.result.hooks.map((h, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        className="ch-ce__hook"
                        title={t('hook.use')}
                        onClick={() => {
                          set({ title_text: h.text });
                          setFlashTitle(true);
                          window.setTimeout(() => setFlashTitle(false), 800);
                        }}
                      >
                        <ArrowUpRight aria-hidden="true" />
                        <span>{h.text}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )
          ) : null}
        </div>
      </Panel>

      <Panel
        id="captions"
        step="2"
        title={t('captions.title')}
        sub={t('captions.sub')}
        open={open === 'captions'}
        onToggle={onToggle}
      >
        <Check checked={form.captions_enabled} onChange={(v) => set({ captions_enabled: v })}>
          {t('captions.burn')}
        </Check>
        <SelectField
          label={t('captions.preset')}
          value={form.captions_preset}
          onChange={(v) => set({ captions_preset: v })}
          options={[
            {
              value: '',
              label: t('captions.presetKit', {
                estilo: payload.choices.caption_presets.includes(kitPreset)
                  ? t(`captions.presets.${kitPreset}`)
                  : kitPreset,
              }),
            },
            ...payload.choices.caption_presets.map((p) => ({
              value: p,
              label: t(`captions.presets.${p}`),
            })),
          ]}
        />
        <div className="ch-ce__field">
          <label htmlFor={hlId}>{t('captions.highlight')}</label>
          <input
            id={hlId}
            type="color"
            className="ch-ce__color"
            value={form.captions_highlight_color || '#FFD700'}
            onChange={(e) => set({ captions_highlight_color: e.target.value })}
          />
        </div>
        <SelectField
          label={t('captions.position')}
          value={form.captions_position}
          onChange={(v) => set({ captions_position: v })}
          options={[
            {
              value: '',
              label:
                aiPos && ['upper_third', 'centered', 'lower_third', 'bottom'].includes(aiPos)
                  ? t('captions.positions.autoAi', { pos: t(`captions.aiPos.${aiPos}`) })
                  : t('captions.positions.auto'),
            },
            ...(['lower_third', 'upper_third', 'centered', 'bottom'] as const).map((p) => ({
              value: p,
              label: t(`captions.positions.${p}`),
            })),
          ]}
          hint={
            <>
              <p className="ch-muted ch-ce__hint">{t('captions.positionHint')}</p>
              {payload.ai_decisions?.caption_position_reason ? (
                <p className="ch-ce__why">
                  <span aria-hidden="true">✨</span> {payload.ai_decisions.caption_position_reason}
                </p>
              ) : null}
            </>
          }
        />
        <SelectField
          label={t('captions.size')}
          value={form.captions_font_size}
          onChange={(v) => set({ captions_font_size: v })}
          options={CAPTION_SIZES.map((s) => ({ value: s, label: t(`captions.sizes.${s}`) }))}
        />
        <SelectField
          label={t('captions.animation')}
          value={form.captions_animation}
          onChange={(v) => set({ captions_animation: v })}
          options={CAPTION_ANIMATIONS.map((a) => ({
            value: a,
            label: t(`captions.animations.${a}`),
          }))}
        />
      </Panel>

      <Panel
        id="brand"
        step="3"
        title={t('brand.title')}
        sub={t('brand.sub')}
        open={open === 'brand'}
        onToggle={onToggle}
      >
        <Check checked={form.banner_enabled} onChange={(v) => set({ banner_enabled: v })}>
          {t('brand.banner')}
        </Check>
        <SelectField
          label={t('brand.platform')}
          value={form.banner_platform}
          onChange={onBannerPlatform}
          options={BANNER_PLATFORMS.map((p) => ({
            value: p,
            label: p === 'instagram' ? 'Instagram' : p.charAt(0).toUpperCase() + p.slice(1),
          }))}
        />
        <div className="ch-ce__field">
          <label htmlFor={urlId}>{t('brand.url')}</label>
          <input
            id={urlId}
            className="ch-input ch-ce__mono"
            type="text"
            maxLength={300}
            value={form.banner_url}
            placeholder={t('brand.urlPlaceholder')}
            onChange={(e) => set({ banner_url: e.target.value })}
          />
        </div>
        <div className="ch-ce__field">
          <label htmlFor={colorId}>{t('brand.color')}</label>
          <input
            id={colorId}
            type="color"
            className="ch-ce__color"
            value={form.banner_color || '#53FC18'}
            onChange={(e) => set({ banner_color: e.target.value })}
          />
        </div>
        <Check checked={form.banner_show_context} onChange={(v) => set({ banner_show_context: v })}>
          {t('brand.context')}
        </Check>
        <SelectField
          label={t('brand.sim')}
          value={form.platform_overlay_preview}
          onChange={(v) => set({ platform_overlay_preview: v })}
          options={payload.choices.platform_sims.map((p) => ({
            value: p,
            label: t(`brand.sims.${p}`),
          }))}
          hint={<p className="ch-muted ch-ce__hint">{t('brand.simHint')}</p>}
        />
        <SelectField
          label={t('brand.safeZone')}
          value={form.safe_zone_platform}
          onChange={(v) => set({ safe_zone_platform: v })}
          options={payload.choices.platform_sims
            .filter((p) => p !== 'clean')
            .map((p) => ({ value: p, label: t(`brand.sims.${p}`) }))}
        />
        <SelectField
          label={t('brand.variant')}
          value={form.banner_variant}
          onChange={(v) => set({ banner_variant: v })}
          options={BANNER_VARIANTS.map((v) => ({ value: v, label: t(`brand.variants.${v}`) }))}
        />
        <Check checked={form.banner_live_badge} onChange={(v) => set({ banner_live_badge: v })}>
          {t('brand.liveBadge')}
        </Check>
      </Panel>
    </>
  );
}
