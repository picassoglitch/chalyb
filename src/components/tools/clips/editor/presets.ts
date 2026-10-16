// Pure editor rules ported 1:1 from the Clips engine's old editor
// (ChalyClip chalybclip/api/templates/clip_detail.html). The engine's export
// renders from the saved overlay, so these only drive what the editor
// applies and previews; keep them in sync with that template.

import type { CaptionLine, EditorForm } from '@/lib/tools/adapters/clips/editor-types';

export const TARGETS = ['tiktok', 'reels', 'shorts', 'kick', 'all'] as const;
export type TargetId = (typeof TARGETS)[number];

export const CLIP_STYLES = [
  'repost_page_viral',
  'clean_creator',
  'gaming_chaos',
  'documentary',
  'minimal_native',
] as const;
export type ClipStyleId = (typeof CLIP_STYLES)[number];

export const FIT_MODES = ['smart_crop', 'blurred_bg', 'letterbox', 'dynamic_zoom'] as const;
export const PREVIEW_MODES = ['raw', 'edited'] as const;
export const BANNER_PLATFORMS = ['kick', 'twitch', 'tiktok', 'youtube', 'instagram'] as const;
export const BANNER_VARIANTS = [
  'kick_repost_page',
  'kick_black_bar_classic',
  'kick_green_block',
  'kick_minimal_url',
] as const;
export const CAPTION_POSITIONS = ['', 'lower_third', 'upper_third', 'centered', 'bottom'] as const;
export const CAPTION_SIZES = ['small', 'medium', 'large', 'xl'] as const;
export const CAPTION_ANIMATIONS = ['pop', 'slide', 'typewriter', 'fade'] as const;
export const TOP_HOOK_STYLES = ['white_rounded', 'black_solid', 'subtle'] as const;
export const HOOK_TONES = ['default', 'aggressive', 'gen_z', 'corporate', 'curious'] as const;
export type HookTone = (typeof HOOK_TONES)[number];

/** Banner color per platform, applied on a platform change unless the
 *  person picked their own color. */
export const PLATFORM_COLORS: Record<string, string> = {
  kick: '#53FC18',
  twitch: '#9146FF',
  tiktok: '#000000',
  youtube: '#FF0000',
  instagram: '#E1306C',
};

export const CAPTION_SCALE: Record<string, number> = {
  small: 0.78,
  medium: 1.0,
  large: 1.24,
  xl: 1.5,
};

type Bundle = Partial<EditorForm>;

/** "Estilo del clip" cards (CLIP_STYLE_PRESETS in the old editor JS). */
export const CLIP_STYLE_PRESETS: Record<ClipStyleId, Bundle> = {
  repost_page_viral: {
    banner_variant: 'kick_repost_page',
    banner_enabled: true,
    top_hook_enabled: true,
    top_hook_style: 'white_rounded',
    captions_preset: 'karaoke_pop',
    captions_position: 'upper_third',
    captions_animation: 'pop',
    captions_font_size: 'medium',
  },
  clean_creator: {
    banner_variant: 'kick_minimal_url',
    banner_enabled: true,
    top_hook_enabled: false,
    top_hook_style: 'white_rounded',
    captions_preset: 'subtle',
    captions_position: 'lower_third',
    captions_animation: 'fade',
    captions_font_size: 'small',
  },
  gaming_chaos: {
    banner_variant: 'kick_green_block',
    banner_enabled: true,
    top_hook_enabled: true,
    top_hook_style: 'white_rounded',
    captions_preset: 'bold_block',
    captions_position: 'centered',
    captions_animation: 'pop',
    captions_font_size: 'large',
  },
  documentary: {
    banner_variant: 'kick_black_bar_classic',
    banner_enabled: true,
    top_hook_enabled: false,
    top_hook_style: 'subtle',
    captions_preset: 'typewriter',
    captions_position: 'bottom',
    captions_animation: 'typewriter',
    captions_font_size: 'medium',
  },
  minimal_native: {
    banner_variant: 'kick_minimal_url',
    banner_enabled: false,
    top_hook_enabled: false,
    top_hook_style: 'subtle',
    captions_preset: 'subtle',
    captions_position: 'lower_third',
    captions_animation: 'fade',
    captions_font_size: 'small',
  },
};

interface PlatformPreset extends Bundle {
  clip_style: ClipStyleId;
  safe_zone_platform: string;
  fit_mode: (typeof FIT_MODES)[number];
}

/** "¿Dónde lo vas a subir?" bundles (PLATFORM_PRESETS_JS, mirrors the
 *  engine's branding/platform_presets.py). */
export const PLATFORM_PRESETS: Record<TargetId, PlatformPreset> = {
  tiktok: {
    safe_zone_platform: 'tiktok',
    fit_mode: 'blurred_bg',
    captions_position: 'lower_third',
    captions_font_size: 'large',
    captions_animation: 'pop',
    captions_lead_ms: 120,
    banner_variant: 'kick_repost_page',
    banner_enabled: true,
    banner_live_badge: false,
    top_hook_enabled: true,
    top_hook_style: 'white_rounded',
    clip_style: 'repost_page_viral',
  },
  reels: {
    safe_zone_platform: 'reels',
    fit_mode: 'blurred_bg',
    captions_position: 'lower_third',
    captions_font_size: 'large',
    captions_animation: 'pop',
    captions_lead_ms: 100,
    banner_variant: 'kick_repost_page',
    banner_enabled: true,
    banner_live_badge: false,
    top_hook_enabled: true,
    top_hook_style: 'white_rounded',
    clip_style: 'repost_page_viral',
  },
  shorts: {
    safe_zone_platform: 'shorts',
    fit_mode: 'blurred_bg',
    captions_position: 'lower_third',
    captions_font_size: 'medium',
    captions_animation: 'slide',
    captions_lead_ms: 80,
    banner_variant: 'kick_repost_page',
    banner_enabled: true,
    banner_live_badge: false,
    top_hook_enabled: true,
    top_hook_style: 'white_rounded',
    clip_style: 'repost_page_viral',
  },
  kick: {
    safe_zone_platform: 'kick',
    fit_mode: 'letterbox',
    captions_position: 'bottom',
    captions_font_size: 'medium',
    captions_animation: 'pop',
    captions_lead_ms: 120,
    banner_variant: 'kick_repost_page',
    banner_enabled: true,
    banner_live_badge: true,
    top_hook_enabled: false,
    top_hook_style: 'white_rounded',
    clip_style: 'repost_page_viral',
  },
  all: {
    safe_zone_platform: 'tiktok',
    fit_mode: 'blurred_bg',
    captions_position: 'lower_third',
    captions_font_size: 'medium',
    captions_animation: 'pop',
    captions_lead_ms: 120,
    banner_variant: 'kick_repost_page',
    banner_enabled: true,
    banner_live_badge: false,
    top_hook_enabled: true,
    top_hook_style: 'white_rounded',
    clip_style: 'repost_page_viral',
  },
};

/** The form after picking a clip style (only the style's fields change). */
export function applyClipStyle(form: EditorForm, style: ClipStyleId): EditorForm {
  return { ...form, ...CLIP_STYLE_PRESETS[style], clip_style: style };
}

/** The form after picking a target platform: the bundled clip style first,
 *  then the platform's own overrides on top (same order as the old JS). */
export function applyTarget(form: EditorForm, target: TargetId): EditorForm {
  const p = PLATFORM_PRESETS[target];
  const styled = applyClipStyle({ ...form, target_platform: target }, p.clip_style);
  const overrides: Partial<PlatformPreset> = { ...p };
  delete overrides.clip_style;
  return { ...styled, ...overrides };
}

/** Fields of `next` that differ from `prev` — what auto-saves to the brand
 *  kit. Only brand-kit fields (the engine whitelist) are returned. */
export const PREF_FIELDS = [
  'banner_enabled',
  'banner_platform',
  'banner_url',
  'banner_color',
  'banner_show_context',
  'banner_show_safezones',
  'captions_preset',
  'captions_highlight_color',
  'captions_position',
  'captions_font_size',
  'captions_animation',
  'captions_lead_ms',
  'banner_variant',
  'banner_live_badge',
  'top_hook_enabled',
  'top_hook_text',
  'top_hook_style',
  'clip_style',
  'target_platform',
] as const satisfies readonly (keyof EditorForm)[];
export type PrefField = (typeof PREF_FIELDS)[number];

export function changedPrefs(
  prev: EditorForm,
  next: EditorForm,
): { field: PrefField; value: EditorForm[PrefField] }[] {
  return PREF_FIELDS.filter((f) => prev[f] !== next[f]).map((f) => ({
    field: f,
    value: f === 'banner_url' ? (next[f] as string).trim() : next[f],
  }));
}

/** "KICK.COM/<HANDLE>" from whatever was typed (aldo, @aldo, kick.com/aldo,
 *  https://www.kick.com/aldo). Empty → the placeholder handle. */
export function formatKickUrl(raw: string, fallback = 'YOURHANDLE'): string {
  let h = (raw || '').trim();
  if (!h) return `KICK.COM/${fallback}`;
  const proto = h.indexOf('://');
  if (proto >= 0) h = h.slice(proto + 3);
  if (h.toLowerCase().startsWith('www.')) h = h.slice(4);
  const slash = h.indexOf('/');
  if (slash >= 0) h = h.slice(slash + 1);
  h = h.replace(/^@+/, '').replace(/\/+$/, '').trim().toUpperCase();
  return `KICK.COM/${h || fallback}`;
}

/** "@handle" for the simulated app chrome. */
export function operatorHandle(rawUrl: string): string {
  const raw = (rawUrl || '').trim();
  if (!raw) return '@yourhandle';
  const bits = raw.split('/');
  const last = (bits[bits.length - 1] || raw).replace(/^@/, '');
  return `@${last.toLowerCase()}`;
}

/** Which simulated app chrome to paint: the "Simular la pantalla de la app"
 *  pick wins (clean = none); with no pick, the target ("all" → TikTok, the
 *  strictest chrome). Same priority as the old editor's syncPlatformSim. */
export function simPlatform(
  form: Pick<EditorForm, 'platform_overlay_preview' | 'target_platform'>,
) {
  const pick = (form.platform_overlay_preview || '').trim();
  if (pick && pick !== 'auto') return pick;
  const t = (form.target_platform || '').toLowerCase();
  if (t === 'all') return 'tiktok';
  if (['tiktok', 'reels', 'shorts', 'kick'].includes(t)) return t;
  return 'clean';
}

export function mmss(s: number): string {
  const v = Number.isFinite(s) && s > 0 ? s : 0;
  const m = Math.floor(v / 60);
  const r = Math.floor(v % 60);
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

export function scoreBand(s: number): 'excellent' | 'very-good' | 'good' | 'weak' | 'skip' {
  return s >= 90
    ? 'excellent'
    : s >= 80
      ? 'very-good'
      : s >= 65
        ? 'good'
        : s >= 40
          ? 'weak'
          : 'skip';
}

/** The caption line on screen at `t` (seconds, read-ahead already added):
 *  a line shows only inside its own window, like the export. */
export function activeLine(lines: CaptionLine[], t: number): number {
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]!;
    if (t >= ln.ts && t < ln.end_ts) return i;
  }
  return -1;
}
