// Typed calls to the Clips engine's core hub API (ChalyClip
// chalybclip/api/routers/hub_streams.py + hub_settings.py, /api/hub/v1).
//
// Every function takes the engine client acting as the person (client.ts),
// so auth, errors and the breaker are shared. Media paths the engine returns
// are turned into absolute URLs here (engine.mediaUrl): the browser loads
// video and images straight from the engine, never through the hub.

import 'server-only';
import { seg, type ClipsEngine } from './client';

// ── shapes (snake_case as the engine sends them) ──────────────────────────

export interface EnginePersona {
  id: string;
  name: string;
  primary_language: string | null;
}

export interface EngineStart {
  personas: EnginePersona[];
  default_persona_id: string | null;
  has_persona: boolean;
  ffmpeg_ok: boolean;
  live_configured: boolean;
  upload: { enabled: boolean; max_bytes: number };
  tier: string;
  status: string;
}

export interface EngineMe {
  api_version: number;
  tenant_id: string;
  user_id: string;
  tier: string;
  status: string;
  is_admin: boolean;
}

export type StatusKind = 'complete' | 'failed' | 'running' | 'pending';

export interface EngineStream {
  id: string;
  title: string | null;
  channel: string | null;
  platform: string;
  vod_url: string | null;
  status: string;
  active: boolean;
  duration_s: number;
  created_at: string;
  is_live: boolean;
  clip_count: number;
  ready_count: number;
  status_kind?: StatusKind;
  thumb_url?: string | null;
  /** The hub already handled this run's outcome (list only). */
  settled?: boolean;
}

export interface EngineClip {
  id: string;
  stream_id: string;
  status: string;
  start_s: number;
  end_s: number;
  duration_s: number;
  created_at: string;
  viral_score: number | null;
  /** Why the AI picked the moment (worded by the hub). */
  why: {
    reason: 'voice' | 'audio' | 'chat' | 'visual' | 'viral' | 'other';
    phrase: string | null;
    speaker: string | null;
    confirmed: boolean;
  } | null;
  publishability_status: string | null;
  title: string | null;
  media_url: string | null;
  download_url: string | null;
  thumb_url: string | null;
  timeline_left_pct?: number;
  timeline_width_pct?: number;
}

export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'abandoned';
export type FailureKind = 'persona' | 'source' | 'too_long' | 'other';

export interface EngineStep {
  name: string;
  status: StepStatus;
  duration_s: number | null;
  elapsed_s: number | null;
  skipped: boolean;
  note: string;
  error_kind: FailureKind | null;
  /** Engine admins only. */
  error?: string;
}

export interface EngineProgress {
  steps: EngineStep[];
  is_running: boolean;
  is_done: boolean;
  has_failed: boolean;
  is_abandoned: boolean;
  failure: { kind: FailureKind; error?: string; error_type?: string } | null;
  in_flight: boolean;
  candidate_count: number;
  clip_count: number;
  can_rerun: boolean;
}

export interface EngineStreamDetail {
  stream: EngineStream;
  overview: {
    status_kind: StatusKind;
    total_clips: number;
    ready_count: number;
    rejected_count: number;
    moments_detected: number;
    best_clip_id: string | null;
    best_score: number | null;
    perf_label: string;
    time_saved_min: number;
    suggested_platforms: string[];
  };
  clips: EngineClip[];
  pending_approval_count: number;
  source_url: string | null;
  can_rerun: boolean;
  personas: EnginePersona[];
  cost: {
    tokens_used: number | null;
    tokens_by_source: { label: string; tokens: number }[];
    estimate_tokens: number;
    runs_available: number | null;
    unlimited: boolean;
    usd_micros?: number;
  };
  progress: EngineProgress;
}

export interface EngineUploadStart {
  stream_id: string;
  upload_url: string;
  method: 'PUT';
  headers: Record<string, string>;
  expires_at: number;
  ticket: string;
}

export interface EngineLive {
  configured: boolean;
  rtmp_url: string | null;
  key: { value: string; masked: string; created_at: string; last_used_at: string | null } | null;
  chalybobs: { full_access: boolean; has_external: boolean; connected: boolean };
  streams: {
    id: string;
    status: string;
    title: string | null;
    live_started_at: string | null;
    live_ended_at: string | null;
  }[];
}

export interface EngineWatch {
  id: string;
  platform: string;
  channel_url: string;
  label: string | null;
  persona_id: string;
  language: string | null;
  enabled: boolean;
  polls_per_day: number;
  max_per_poll: number;
  seen_count: number;
  last_polled_at: string | null;
  created_at: string;
}

export interface EnginePersonaFull {
  id: string;
  name: string;
  primary_language: string;
  target_languages: string[];
  voice_prompt: string;
  routing_tags: string[];
  created_at: string;
}

export interface EngineKitSummary {
  id: string;
  name: string;
  is_default: boolean;
  primary_color: string;
  accent_color: string;
  default_layout: string;
  forward_count: number;
  retroactive_count: number;
  has_logo: boolean;
}

export interface EngineKit extends EngineKitSummary {
  handles: {
    tiktok: string | null;
    youtube: string | null;
    instagram: string | null;
    kick: string | null;
  };
  caption_preset: string;
  forward_phrases: string[];
  retroactive_phrases: string[];
  safe_schedule_enabled: boolean;
  content_timezone: string;
  safety_preset: string;
  show_chalybclip_outro: boolean;
  logo_svg: string | null;
  ai_prompt: string | null;
}

export interface EngineKitInput {
  name: string;
  handle_tiktok: string;
  handle_youtube: string;
  handle_instagram: string;
  handle_kick: string;
  caption_preset: string;
  forward_phrases: string[];
  retroactive_phrases: string[];
  safe_schedule_enabled: boolean;
  content_timezone: string;
  safety_preset: string;
  show_chalybclip_outro: boolean;
  is_default?: boolean;
}

export interface EngineCalibration {
  reports: {
    platform: string;
    pearson_r: number | null;
    n_paired: number;
    rows: {
      clip_id: string;
      rescore_score: number | null;
      views: number | null;
      likes: number | null;
      fetched_at: string | null;
    }[];
  }[];
}

export interface EngineLlmCalls {
  calls: {
    id: string;
    ts: string;
    purpose: string;
    provider: string;
    model: string;
    quality: string;
    input_tokens: number;
    output_tokens: number;
    cost_usd_micros: number;
    status: string;
    attempts: number;
    stream_id: string | null;
  }[];
  total_usd_micros: number;
  projection: {
    today_micros: number;
    mtd_micros: number;
    projected_eom_micros: number;
    by_purpose: Record<string, number>;
    by_model: Record<string, number>;
    daily_budget_micros: number | null;
    budget_consumed_frac: number | null;
    n_calls_mtd: number;
  };
}

export interface EngineLlmSettings {
  providers: {
    name: string;
    kind: string;
    standard: string;
    premium: string | null;
    timeout_s: number | null;
  }[];
  routing: { purpose: string; default_quality: string; primary: string; fallbacks: string[] }[];
}

// ── media ────────────────────────────────────────────────────────────────

async function absClip(engine: ClipsEngine, c: EngineClip): Promise<EngineClip> {
  const [media_url, download_url, thumb_url] = await Promise.all([
    engine.mediaUrl(c.media_url),
    engine.mediaUrl(c.download_url),
    engine.mediaUrl(c.thumb_url),
  ]);
  return { ...c, media_url, download_url, thumb_url };
}

// ── calls ────────────────────────────────────────────────────────────────

export const getMe = (e: ClipsEngine, signal?: AbortSignal) => e.get<EngineMe>('/me', { signal });

export const getStart = (e: ClipsEngine, signal?: AbortSignal) =>
  e.get<EngineStart>('/start', { signal });

export const createUrlJob = (
  e: ClipsEngine,
  body: { vod_url: string; persona_id?: string | null; boost?: boolean | null },
  signal?: AbortSignal,
) => e.post<{ stream_id: string }>('/url-jobs', body, { signal });

export const startUpload = (
  e: ClipsEngine,
  body: {
    filename: string;
    size_bytes: number;
    content_type: string;
    persona_id?: string | null;
    boost?: boolean | null;
  },
  signal?: AbortSignal,
) => e.post<EngineUploadStart>('/uploads', body, { signal });

export const completeUpload = (
  e: ClipsEngine,
  streamId: string,
  ticket: string,
  signal?: AbortSignal,
) => e.post<{ stream_id: string }>(`/uploads/${seg(streamId)}/complete`, { ticket }, { signal });

export const abortUpload = (
  e: ClipsEngine,
  streamId: string,
  ticket: string,
  signal?: AbortSignal,
) => e.post<{ ok: true }>(`/uploads/${seg(streamId)}/abort`, { ticket }, { signal });

export async function listStreams(
  e: ClipsEngine,
  limit = 50,
  signal?: AbortSignal,
): Promise<EngineStream[]> {
  const { streams } = await e.get<{ streams: EngineStream[] }>('/streams', {
    query: { limit },
    signal,
  });
  return Promise.all(
    streams.map(async (s) => ({ ...s, thumb_url: await e.mediaUrl(s.thumb_url) })),
  );
}

export async function getStream(
  e: ClipsEngine,
  id: string,
  signal?: AbortSignal,
): Promise<EngineStreamDetail> {
  const d = await e.get<EngineStreamDetail>(`/streams/${seg(id)}`, { signal });
  const [clips, source_url] = await Promise.all([
    Promise.all(d.clips.map((c) => absClip(e, c))),
    e.mediaUrl(d.source_url),
  ]);
  return { ...d, clips, source_url };
}

export const getProgress = (e: ClipsEngine, id: string, signal?: AbortSignal) =>
  e.get<EngineProgress>(`/streams/${seg(id)}/progress`, { signal });

export const rerunStream = (
  e: ClipsEngine,
  id: string,
  body: { persona_id: string; boost?: boolean | null },
  signal?: AbortSignal,
) => e.post<{ stream_id: string }>(`/streams/${seg(id)}/rerun`, body, { signal });

export const approveAll = (e: ClipsEngine, id: string, signal?: AbortSignal) =>
  e.post<{ approved: number }>(`/streams/${seg(id)}/approve-all`, undefined, { signal });

export async function downloadApproved(
  e: ClipsEngine,
  id: string,
  signal?: AbortSignal,
): Promise<{ url: string | null }> {
  const { url } = await e.post<{ url: string }>(
    `/streams/${seg(id)}/download-approved`,
    undefined,
    {
      signal,
    },
  );
  return { url: await e.mediaUrl(url) };
}

export const deleteStream = (e: ClipsEngine, id: string, signal?: AbortSignal) =>
  e.del<{ deleted: boolean }>(`/streams/${seg(id)}`, { signal });

export const settleStream = (e: ClipsEngine, id: string, signal?: AbortSignal) =>
  e.post<{ first: boolean }>(`/streams/${seg(id)}/settle`, undefined, { signal });

export async function listEngineClips(
  e: ClipsEngine,
  limit = 60,
  signal?: AbortSignal,
): Promise<EngineClip[]> {
  const { clips } = await e.get<{ clips: EngineClip[] }>('/clips', { query: { limit }, signal });
  return Promise.all(clips.map((c) => absClip(e, c)));
}

export const getLive = (e: ClipsEngine, signal?: AbortSignal) =>
  e.get<EngineLive>('/live', { signal });
export const rotateLiveKey = (e: ClipsEngine, signal?: AbortSignal) =>
  e.post<EngineLive>('/live/rotate-key', undefined, { signal });
export const setLiveConnection = (e: ClipsEngine, enabled: boolean, signal?: AbortSignal) =>
  e.post<EngineLive>('/live/connection', { enabled }, { signal });

export const getSources = (e: ClipsEngine, signal?: AbortSignal) =>
  e.get<{ watches: EngineWatch[]; personas: { id: string; name: string }[] }>('/sources', {
    signal,
  });
export const addSource = (
  e: ClipsEngine,
  body: {
    channel_url: string;
    persona_id: string;
    platform?: string;
    language?: string;
    label?: string;
    max_per_poll?: number;
    polls_per_day?: number;
  },
  signal?: AbortSignal,
) => e.post<{ watch: EngineWatch }>('/sources', body, { signal });
export const patchSource = (
  e: ClipsEngine,
  id: string,
  body: { enabled?: boolean; polls_per_day?: number },
  signal?: AbortSignal,
) => e.patch<{ watch: EngineWatch }>(`/sources/${seg(id)}`, body, { signal });
export const deleteSource = (e: ClipsEngine, id: string, signal?: AbortSignal) =>
  e.del<{ deleted: boolean }>(`/sources/${seg(id)}`, { signal });
export const pollSource = (e: ClipsEngine, id: string, signal?: AbortSignal) =>
  e.post<{ scanning: boolean }>(`/sources/${seg(id)}/poll`, undefined, { signal });

export const getPersonas = (e: ClipsEngine, signal?: AbortSignal) =>
  e.get<{ personas: EnginePersonaFull[] }>('/personas', { signal });
export const createPersona = (
  e: ClipsEngine,
  body: Omit<EnginePersonaFull, 'created_at'>,
  signal?: AbortSignal,
) => e.post<{ persona: EnginePersonaFull }>('/personas', body, { signal });
export const updatePersona = (
  e: ClipsEngine,
  id: string,
  body: Omit<EnginePersonaFull, 'created_at' | 'id'>,
  signal?: AbortSignal,
) => e.put<{ persona: EnginePersonaFull }>(`/personas/${seg(id)}`, body, { signal });

export const listKits = (e: ClipsEngine, signal?: AbortSignal) =>
  e.get<{
    kits: EngineKitSummary[];
    caption_presets: string[];
    safety_presets: string[];
    tier: string;
  }>('/brand-kits', { signal });
export const getKit = (e: ClipsEngine, id: string, signal?: AbortSignal) =>
  e.get<{ kit: EngineKit; tier: string }>(`/brand-kits/${seg(id)}`, { signal });
export const createKit = (e: ClipsEngine, body: EngineKitInput, signal?: AbortSignal) =>
  e.post<{ kit: EngineKit }>('/brand-kits', body, { signal });
export const updateKit = (e: ClipsEngine, id: string, body: EngineKitInput, signal?: AbortSignal) =>
  e.put<{ kit: EngineKit }>(`/brand-kits/${seg(id)}`, body, { signal });
export const setDefaultKit = (e: ClipsEngine, id: string, signal?: AbortSignal) =>
  e.post<{ ok: true }>(`/brand-kits/${seg(id)}/default`, undefined, { signal });
export const deleteKit = (e: ClipsEngine, id: string, signal?: AbortSignal) =>
  e.del<{ deleted: boolean }>(`/brand-kits/${seg(id)}`, { signal });
export const generateKitLogo = (
  e: ClipsEngine,
  id: string,
  styleHint: string,
  signal?: AbortSignal,
) =>
  e.post<{ kit: EngineKit }>(`/brand-kits/${seg(id)}/logo`, { style_hint: styleHint }, { signal });

export const getCalibration = (e: ClipsEngine, signal?: AbortSignal) =>
  e.get<EngineCalibration>('/calibration', { signal });

export const getLlmCalls = (e: ClipsEngine, signal?: AbortSignal) =>
  e.get<EngineLlmCalls>('/admin/llm-calls', { signal });
export const getLlmSettings = (e: ClipsEngine, signal?: AbortSignal) =>
  e.get<EngineLlmSettings>('/admin/llm-settings', { signal });
export const getSiteSettings = (e: ClipsEngine, signal?: AbortSignal) =>
  e.get<{ price_es: string; price_en: string }>('/admin/site-settings', { signal });
export const saveSiteSettings = (
  e: ClipsEngine,
  body: { price_es: string; price_en: string },
  signal?: AbortSignal,
) => e.put<{ price_es: string; price_en: string }>('/admin/site-settings', body, { signal });
