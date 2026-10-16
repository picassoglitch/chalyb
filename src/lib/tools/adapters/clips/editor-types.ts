// The clip editor's contract with the Clips engine (ChalyClip
// chalybclip/api/routers/hub_editor.py, /api/hub/v1/clips/{id}/…).
// Pure types plus the request cleaners the BFF runs before anything reaches
// the engine. Field names match the engine (and the old editor form) so the
// engine's own normalization stays the single source of truth.

/** Every control of the editor, as the old form posted it. */
export interface EditorForm {
  target_platform: string;
  clip_style: string;
  title_text: string;
  captions_enabled: boolean;
  captions_preset: string;
  captions_highlight_color: string;
  captions_position: string;
  captions_font_size: string;
  captions_animation: string;
  captions_lead_ms: number;
  banner_enabled: boolean;
  banner_platform: string;
  banner_url: string;
  banner_color: string;
  banner_show_context: boolean;
  banner_show_safezones: boolean;
  banner_variant: string;
  banner_live_badge: boolean;
  platform_overlay_preview: string;
  safe_zone_platform: string;
  preview_mode: string;
  fit_mode: string;
  top_hook_enabled: boolean;
  top_hook_text: string;
  top_hook_style: string;
  comments_show: boolean;
  comments_fake_likes: number;
}

export const CLIP_FORMAT_IDS = ['vertical', 'horizontal', 'square'] as const;
export type ClipFormatId = (typeof CLIP_FORMAT_IDS)[number];

export type ClipStatus = 'cut' | 'ready_for_review' | 'approved' | 'rejected' | 'published';
export type VerdictStatus = 'publish_ready' | 'needs_edit' | 'reject';

export interface Publishability {
  score: number;
  status: VerdictStatus;
  reasons: string[];
  warnings: string[];
  blocking: string[];
  recommended_action: string;
}

export interface Breakdown {
  clip_id: string;
  duration_s: number;
  motion_score: number | null;
  face_presence: number | null;
  speaking_intensity: number | null;
  reaction_confidence: number | null;
  rescore_delta: number | null;
  rescore_reason: string | null;
  heuristic_reason: string;
  heuristic_score: number;
}

export interface AiScores {
  viral_score: number;
  viral_why: string;
  hook_strength: string;
  hook_why: string;
  caption_readability: string;
  readability_why: string;
  dead_air_risk: string;
  dead_air_why: string;
}

export interface AutoCorrections {
  corrections: { label: string }[];
  score_before: number;
  score_after: number;
  ready: boolean;
}

export interface CandidateTrigger {
  phrase: string;
  snippet: string;
  kind: string;
}

export interface ClipOutcome {
  platform: string;
  status: string;
  external_url: string | null;
  external_id: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  fetched_at: string | null;
}

export interface ZoneSpec {
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  reason: string;
}

export interface EditorPayload {
  clip: {
    id: string;
    stream_id: string;
    stream_title: string;
    status: ClipStatus | string;
    duration_s: number;
    start_s: number;
    end_s: number;
    original_start_s: number | null;
    original_end_s: number | null;
    has_overlay: boolean;
    has_thumbnail: boolean;
    render_state: string;
    created_at: string;
  };
  /** Short-lived signed links to the engine (ChalyClip api/hub_media.py).
   *  From the engine they're paths; the BFF makes them absolute URLs the
   *  browser loads directly (video bytes never go through the hub). */
  media: {
    preview: string | null;
    thumbnail: string | null;
    /** Base video of the 16:9 / 1:1 formats (made on first load). */
    formats?: Partial<Record<'horizontal' | 'square', string | null>>;
  };
  /** Where a manual trim may go (stream seconds), the length limits and the
   *  word timings in that window (for snapping). */
  trim: {
    window: [number, number];
    start_s: number;
    end_s: number;
    min_s: number;
    max_s: number;
    source_available: boolean;
    words: [number, number][];
  };
  formats: { current: ClipFormatId; available: ClipFormatId[] };
  /** Publishing as the editor shows it: the auto-publish-on-approve job
   *  (pending/failed) and the posts made. */
  publish_state: { auto: string | null; posts: { status: string; platforms: string[] }[] };
  can_finalize: boolean;
  can_reject: boolean;
  next_clip_id: string | null;
  form: EditorForm;
  default_handle: string;
  caption_style: { preset: string; position: string; highlight_color: string } & Record<
    string,
    unknown
  >;
  publishability: Publishability;
  intel_lines: string[];
  ai_scores: AiScores | null;
  breakdown: Breakdown;
  ai_decisions: { caption_position?: string; caption_position_reason?: string } | null;
  auto_corrections: AutoCorrections | null;
  candidate_trigger: CandidateTrigger | null;
  face_zone: 'top' | 'mid' | 'lower' | null;
  outcomes: ClipOutcome[];
  choices: {
    caption_presets: string[];
    clip_styles: string[];
    targets: string[];
    platform_sims: string[];
    zone_specs: Record<string, ZoneSpec[]>;
    export_qualities: string[];
  };
}

export interface CaptionWord {
  ts: number;
  end_ts: number;
  text: string;
  emphasis?: string;
}
export interface CaptionLine {
  ts: number;
  end_ts: number;
  text: string;
  emphasis?: string;
  words: CaptionWord[];
}
export interface CaptionsFeed {
  lines: CaptionLine[];
  duration_s: number;
  diagnostics: { reason: string; language?: string | null } | null;
}

export interface TimelineMarker {
  kind: string;
  ts: number;
  score: number;
  label: string;
}
export interface IntelligenceFeed {
  markers: TimelineMarker[];
  duration_s: number;
}

export interface GrowthFeed {
  scored: boolean;
  overall_score?: number;
  decision?: string;
  card?: {
    overall_score?: number;
    decision?: string;
    summary?: string;
    platforms?: {
      platform: string;
      score?: number;
      label?: string;
      verdict?: string;
      expected_impressions_low?: number;
      expected_impressions_high?: number;
    }[];
    recommendations?: { detail?: string; action?: string }[];
  } | null;
}

export type RenderState = 'idle' | 'rendering' | 'ready' | 'failed';
export interface RenderStatus {
  state: RenderState;
  progress_pct: number;
  error: string | null;
  quality: string;
  /** When ready: the signed download link (absolute once through the BFF). */
  download: string | null;
}

export interface HookIdeas {
  hooks: { text: string }[];
  tone: string;
  source: 'llm' | 'deterministic' | string;
}

export interface FinalizeResult {
  status: string;
  stream_id: string;
  next_clip_id: string | null;
}

export const EXPORT_QUALITIES = ['1080', '2k', '4k'] as const;
export type ExportQuality = (typeof EXPORT_QUALITIES)[number];

export function parseQuality(raw: unknown): ExportQuality {
  return typeof raw === 'string' && (EXPORT_QUALITIES as readonly string[]).includes(raw)
    ? (raw as ExportQuality)
    : '1080';
}

const STR_LIMITS: Partial<Record<keyof EditorForm, number>> = {
  title_text: 500,
  banner_url: 300,
  top_hook_text: 120,
};

const BOOL_FIELDS = [
  'captions_enabled',
  'banner_enabled',
  'banner_show_context',
  'banner_show_safezones',
  'banner_live_badge',
  'top_hook_enabled',
  'comments_show',
] as const satisfies readonly (keyof EditorForm)[];

const STR_FIELDS = [
  'target_platform',
  'clip_style',
  'title_text',
  'captions_preset',
  'captions_highlight_color',
  'captions_position',
  'captions_font_size',
  'captions_animation',
  'banner_platform',
  'banner_url',
  'banner_color',
  'banner_variant',
  'platform_overlay_preview',
  'safe_zone_platform',
  'preview_mode',
  'fit_mode',
  'top_hook_text',
  'top_hook_style',
] as const satisfies readonly (keyof EditorForm)[];

/** The overlay body the BFF forwards: only known fields, right types,
 *  bounded. Unknown keys are dropped; the engine normalizes the values. */
export function parseOverlayBody(body: unknown): Partial<EditorForm> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of BOOL_FIELDS) if (typeof b[k] === 'boolean') out[k] = b[k];
  for (const k of STR_FIELDS) {
    const v = b[k];
    if (typeof v === 'string') out[k] = v.slice(0, STR_LIMITS[k] ?? 40);
  }
  const lead = b.captions_lead_ms;
  if (typeof lead === 'number' && Number.isFinite(lead))
    out.captions_lead_ms = Math.max(0, Math.min(500, Math.round(lead)));
  if (typeof b.format === 'string' && (CLIP_FORMAT_IDS as readonly string[]).includes(b.format))
    (out as Record<string, unknown>).format = b.format;
  const likes = b.comments_fake_likes;
  if (typeof likes === 'number' && Number.isFinite(likes))
    out.comments_fake_likes = Math.max(0, Math.min(999_999, Math.round(likes)));
  return out as Partial<EditorForm>;
}

/** Brand-kit fields the engine accepts on /brand-kit/prefs. */
export const PREF_FIELD_NAMES = [
  'banner_enabled',
  'banner_platform',
  'banner_url',
  'banner_color',
  'banner_show_context',
  'banner_show_safezones',
  'banner_variant',
  'banner_live_badge',
  'captions_preset',
  'captions_highlight_color',
  'captions_position',
  'captions_font_size',
  'captions_animation',
  'captions_lead_ms',
  'top_hook_enabled',
  'top_hook_text',
  'top_hook_style',
  'clip_style',
  'target_platform',
] as const;

export function parsePref(
  body: unknown,
): { field: (typeof PREF_FIELD_NAMES)[number]; value: string | number | boolean } | null {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const field = b.field;
  if (typeof field !== 'string' || !(PREF_FIELD_NAMES as readonly string[]).includes(field))
    return null;
  const v = b.value;
  if (typeof v === 'boolean')
    return { field: field as (typeof PREF_FIELD_NAMES)[number], value: v };
  if (typeof v === 'number' && Number.isFinite(v))
    return { field: field as (typeof PREF_FIELD_NAMES)[number], value: Math.round(v) };
  if (typeof v === 'string')
    return { field: field as (typeof PREF_FIELD_NAMES)[number], value: v.slice(0, 300) };
  return null;
}

/** Manual trim body: two finite numbers (stream seconds); the engine
 *  validates bounds and length. */
export function parseTrimBody(body: unknown): { start_s: number; end_s: number } | null {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const s = b.start_s;
  const e = b.end_s;
  if (typeof s !== 'number' || typeof e !== 'number' || !Number.isFinite(s) || !Number.isFinite(e))
    return null;
  return { start_s: s, end_s: e };
}

/** The AI text language the engine should answer in. */
export function parseLang(raw: string | null): 'es' | 'en' {
  return raw === 'en' ? 'en' : 'es';
}

export const HOOK_TONE_IDS = ['default', 'aggressive', 'gen_z', 'corporate', 'curious'] as const;

export function parseHooksBody(body: unknown): { tone: string; n: number } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const tone =
    typeof b.tone === 'string' && (HOOK_TONE_IDS as readonly string[]).includes(b.tone)
      ? b.tone
      : 'default';
  const n = typeof b.n === 'number' && Number.isInteger(b.n) ? Math.max(1, Math.min(10, b.n)) : 5;
  return { tone, n };
}

/** Engine clip ids are ULID-ish (clp_…); anything else is not a clip. */
export const CLIP_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
