// Request parsing for the Clips engine BFF routes (/api/tools/chalybclip/**,
// mode "a"). Pure: whatever the browser sends is cleaned here, or refused as
// BAD_REQUEST (ToolRequestError), before the engine sees it.

import { ToolRequestError } from './bff-core';

type Body = Record<string, unknown>;

function str(b: Body, key: string, max: number, opts: { required?: boolean } = {}): string {
  const v = b[key];
  if (v === undefined || v === null) {
    if (opts.required) throw new ToolRequestError(`${key} required`);
    return '';
  }
  if (typeof v !== 'string') throw new ToolRequestError(`${key} must be text`);
  const t = v.trim();
  if (opts.required && !t) throw new ToolRequestError(`${key} required`);
  if (t.length > max) throw new ToolRequestError(`${key} too long`);
  return t;
}

function bool(b: Body, key: string): boolean | undefined {
  const v = b[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'boolean') throw new ToolRequestError(`${key} must be true/false`);
  return v;
}

function int(b: Body, key: string, min: number, max: number): number | undefined {
  const v = b[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max)
    throw new ToolRequestError(`${key} out of range`);
  return v;
}

function list(b: Body, key: string, maxItems: number, maxLen: number): string[] {
  const v = b[key];
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > maxItems) throw new ToolRequestError(`${key} bad list`);
  return v
    .map((x) => {
      if (typeof x !== 'string') throw new ToolRequestError(`${key} bad item`);
      return x.trim().slice(0, maxLen);
    })
    .filter(Boolean);
}

/** An id the engine minted (str_…, brk_…, cw_…) or a persona slug. */
export function parseId(raw: string | undefined): string {
  if (!raw || !/^[A-Za-z0-9_-]{1,64}$/.test(raw)) throw new ToolRequestError('bad id');
  return raw;
}

export const UPLOAD_TYPES = ['video/mp4', 'video/quicktime', 'video/x-matroska', 'video/webm'];

export function parseUploadStart(b: Body) {
  const content_type = str(b, 'content_type', 100, { required: true }).toLowerCase();
  if (!UPLOAD_TYPES.includes(content_type)) throw new ToolRequestError('bad type');
  const size_bytes = b.size_bytes;
  if (typeof size_bytes !== 'number' || !Number.isSafeInteger(size_bytes) || size_bytes <= 0)
    throw new ToolRequestError('bad size');
  const persona = str(b, 'persona_id', 64);
  return {
    filename: str(b, 'filename', 255, { required: true }),
    size_bytes,
    content_type,
    persona_id: persona ? parseId(persona) : null,
    boost: bool(b, 'boost') ?? null,
  };
}

export function parseTicket(b: Body): string {
  const t = str(b, 'ticket', 4000, { required: true });
  if (!/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/.test(t)) throw new ToolRequestError('bad ticket');
  return t;
}

export function parseRerun(b: Body) {
  return {
    persona_id: parseId(str(b, 'persona_id', 64, { required: true })),
    boost: bool(b, 'boost') ?? null,
  };
}

export function parseLiveConnection(b: Body) {
  const enabled = bool(b, 'enabled');
  if (enabled === undefined) throw new ToolRequestError('enabled required');
  return { enabled };
}

export const POLLS_PER_DAY = [1, 2, 4, 6, 12, 24] as const;
export const SOURCE_PLATFORMS = ['', 'youtube', 'twitch', 'kick'] as const;

export function parseSourceAdd(b: Body) {
  const platform = str(b, 'platform', 20);
  if (!(SOURCE_PLATFORMS as readonly string[]).includes(platform))
    throw new ToolRequestError('bad platform');
  const url = str(b, 'channel_url', 500, { required: true });
  if (!/^https?:\/\//i.test(url)) throw new ToolRequestError('bad url');
  return {
    channel_url: url,
    persona_id: parseId(str(b, 'persona_id', 64, { required: true })),
    platform,
    language: str(b, 'language', 16),
    label: str(b, 'label', 120),
    max_per_poll: int(b, 'max_per_poll', 1, 25) ?? 3,
    polls_per_day: int(b, 'polls_per_day', 1, 96) ?? 1,
  };
}

export function parseSourcePatch(b: Body) {
  const out: { enabled?: boolean; polls_per_day?: number } = {};
  const enabled = bool(b, 'enabled');
  if (enabled !== undefined) out.enabled = enabled;
  const ppd = int(b, 'polls_per_day', 1, 96);
  if (ppd !== undefined) out.polls_per_day = ppd;
  if (!Object.keys(out).length) throw new ToolRequestError('nothing to change');
  return out;
}

export function parsePersona(b: Body, withId: boolean) {
  const out = {
    name: str(b, 'name', 120, { required: true }),
    primary_language: str(b, 'primary_language', 16, { required: true }),
    voice_prompt: str(b, 'voice_prompt', 8000, { required: true }),
    target_languages: list(b, 'target_languages', 20, 16),
    routing_tags: list(b, 'routing_tags', 40, 40),
  };
  if (!withId) return out;
  return { id: parseId(str(b, 'id', 64, { required: true })), ...out };
}

export const SAFETY_PRESETS = ['recommended', 'cautious', 'active'] as const;

export function parseKit(b: Body) {
  const safety = str(b, 'safety_preset', 20) || 'recommended';
  if (!(SAFETY_PRESETS as readonly string[]).includes(safety))
    throw new ToolRequestError('bad safety preset');
  const preset = str(b, 'caption_preset', 40) || 'karaoke_pop';
  if (!/^[a-z_]{1,40}$/.test(preset)) throw new ToolRequestError('bad caption preset');
  const tz = str(b, 'content_timezone', 64) || 'UTC';
  if (!/^[A-Za-z0-9_+\-/]{1,64}$/.test(tz)) throw new ToolRequestError('bad timezone');
  return {
    name: str(b, 'name', 120, { required: true }),
    handle_tiktok: str(b, 'handle_tiktok', 100),
    handle_youtube: str(b, 'handle_youtube', 100),
    handle_instagram: str(b, 'handle_instagram', 100),
    handle_kick: str(b, 'handle_kick', 100),
    caption_preset: preset,
    forward_phrases: list(b, 'forward_phrases', 200, 200),
    retroactive_phrases: list(b, 'retroactive_phrases', 200, 200),
    safe_schedule_enabled: bool(b, 'safe_schedule_enabled') ?? false,
    content_timezone: tz,
    safety_preset: safety,
    show_chalybclip_outro: bool(b, 'show_chalybclip_outro') ?? true,
    is_default: bool(b, 'is_default') ?? false,
  };
}

export function parseLogo(b: Body) {
  return { style_hint: str(b, 'style_hint', 200) };
}

export function parseSiteSettings(b: Body) {
  return { price_es: str(b, 'price_es', 120), price_en: str(b, 'price_en', 120) };
}
