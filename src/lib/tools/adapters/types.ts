// The contract between the hub's Clips screens and whatever makes the clips.
//
// The hub never talks to the Clips engine's internals. It submits a job and
// reads back a normalized state (BUILD-SPEC §4.2.3) that drives the "Creando"
// screen, and a normalized failure reason (§4.2.4) that picks the error copy.
// The mock adapter implements this for tests and previews; the engine adapter
// lands once the Clips team publishes its job API (OPS-13, owner question Q4).
//
// Pure types, no imports.

export const CLIP_JOB_STATES = [
  'received',
  'finding_moments',
  'adding_captions',
  'ready',
  'failed',
] as const;
export type ClipJobState = (typeof CLIP_JOB_STATES)[number];

export const CLIP_FAILURE_REASONS = [
  'link_private',
  'link_unsupported',
  'video_too_long',
  'no_credits',
  'platform_down',
  'unknown',
] as const;
export type ClipFailureReason = (typeof CLIP_FAILURE_REASONS)[number];

export const CLIP_FORMATS = ['vertical', 'horizontal', 'square'] as const;
export type ClipFormat = (typeof CLIP_FORMATS)[number];

export const CLIP_COUNTS = [3, 6, 10] as const;
export type ClipCount = (typeof CLIP_COUNTS)[number];

export interface Clip {
  id: string;
  title: string;
  durationSec: number;
  downloadUrl: string;
}

export interface ClipJob {
  id: string;
  userId: string;
  sourceUrl: string;
  format: ClipFormat;
  count: ClipCount;
  state: ClipJobState;
  /** Set only when state is 'failed'. */
  reason?: ClipFailureReason;
  /** Moments found so far, once known ("Encontramos {n}"). */
  momentsFound: number | null;
  clips: Clip[];
  /** A short name for the video when the engine knows it ("Torneo del
   *  sábado"); screens fall back to the platform name. */
  title?: string;
  /** The engine's estimate of minutes left while working; never invented. */
  etaMinutes?: number;
  /** How many times the job has been submitted (1 + automatic retries). */
  attempts: number;
  /** Whether the hub has applied its policy to the finished job: charged
   *  credits for 'ready', logged the reason for 'failed'. Done exactly once. */
  settled: boolean;
  createdAt: string;
}

export const CAPTION_STYLES = ['clasico', 'grande', 'ninguno'] as const;
export type CaptionStyle = (typeof CAPTION_STYLES)[number];

/** Opciones avanzadas (SCR-06). Every field optional: "si no tocas nada,
 *  usamos la mejor configuración por ti". */
export interface ClipJobOptions {
  captionStyle?: CaptionStyle;
  captionLang?: 'es' | 'en';
  /** Seconds per clip, 15–60 (BUILD-SPEC §4.3). */
  minSec?: number;
  maxSec?: number;
}

/** What this engine can do; each SCR-06 row and each connect button shows
 *  only when its flag is true (no button without an action). */
export interface ClipsCapabilities {
  /** Platforms whose links the engine reads ("Funciona con …"). */
  sources: string[];
  bulkUpload: boolean;
  captionStyles: boolean;
  customDuration: boolean;
  watermark: boolean;
  fileUpload: boolean;
  /** Account connect (OAuth) and autopublish. */
  supportsConnect: boolean;
  /** Whether a finished job uses no credits when it fails (P0 rule). */
  confirmsNoChargeOnFailure: boolean;
  /** Clip editing in the detail screen (title, captions, trim, format). */
  editClips: boolean;
  /** "Encuadre: Centro automático / Seguir a la persona". */
  framing: boolean;
  /** "Acceso API" (keys for the professional plan). */
  apiAccess: boolean;
}

// ── Clips inside the app (WS-11, TOOLS-SPEC §1.3 / §4) ─────────────────
export const CAPTION_PRESETS = ['clasico', 'amarillo', 'fondo'] as const;
export type CaptionPreset = (typeof CAPTION_PRESETS)[number];

export const SOCIAL_PLATFORMS = ['youtube', 'twitch', 'tiktok', 'kick', 'facebook'] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export interface ClipTrim {
  startS: number;
  endS: number;
}

/** One finished clip, with the person's edits applied. The original is
 *  never deleted: edits re-render a copy (§1.3 PATCH /clips/{id}). */
export interface ClipDetail {
  id: string;
  jobId: string;
  title: string;
  /** Length of the moment the engine cut (the trim can't go past it). */
  sourceDurationSec: number;
  format: ClipFormat;
  captionsOn: boolean;
  trim: ClipTrim;
  createdAt: string;
  /** Same-tab download (Content-Disposition: attachment). */
  downloadUrl: string;
  thumbUrl: string | null;
  previewUrl: string | null;
}

export interface ClipPatch {
  title?: string;
  captionsOn?: boolean;
  trim?: ClipTrim;
  format?: ClipFormat;
}

/** Ajustes de Clips (§4.3): used for the person's next clips. */
export interface ClipsSettings {
  captionsOn: boolean;
  captionLang: 'es' | 'en';
  captionPreset: CaptionPreset;
  watermarkOn: boolean;
  /** "auto" or a fixed 15–60 s length. */
  duration: 'auto' | number;
  framing: 'center' | 'follow';
}

export const DEFAULT_CLIPS_SETTINGS: ClipsSettings = {
  captionsOn: true,
  captionLang: 'es',
  captionPreset: 'amarillo',
  watermarkOn: false,
  duration: 'auto',
  framing: 'center',
};

export interface ConnectedAccount {
  platform: SocialPlatform;
  /** "@MariaEnVivo" when connected. */
  handle: string | null;
  connected: boolean;
}

export interface CreateClipJobInput {
  userId: string;
  sourceUrl: string;
  format: ClipFormat;
  count: ClipCount;
  options?: ClipJobOptions;
}

export type CreateClipJobResult =
  | { ok: true; jobId: string }
  | { ok: false; reason: ClipFailureReason };

export interface ClipsAdapter {
  capabilities(): ClipsCapabilities;
  createJob(input: CreateClipJobInput): Promise<CreateClipJobResult>;
  /** Null when the job doesn't exist or belongs to another user. */
  getJob(userId: string, jobId: string): Promise<ClipJob | null>;
  /** The user's jobs, newest first (Mis resultados). */
  listJobs(userId: string, limit?: number): Promise<ClipJob[]>;
  /** Resubmit a failed job in place (same id). */
  retryJob(userId: string, jobId: string): Promise<void>;
  /** Atomically mark a finished job settled (see ClipJob.settled). Returns
   *  true only for the one call that flipped it, so concurrent readers can't
   *  charge twice. */
  markSettled(userId: string, jobId: string): Promise<boolean>;

  // Clip level (WS-11). Null when the clip doesn't exist or isn't theirs.
  /** The user's finished clips, newest first. */
  listClips(userId: string, limit?: number): Promise<ClipDetail[]>;
  getClip(userId: string, clipId: string): Promise<ClipDetail | null>;
  patchClip(userId: string, clipId: string, patch: ClipPatch): Promise<ClipDetail | null>;
  getSettings(userId: string): Promise<ClipsSettings>;
  saveSettings(userId: string, settings: ClipsSettings): Promise<void>;
  /** Accounts the person connected. Empty without supportsConnect. */
  accounts(userId: string): Promise<ConnectedAccount[]>;
  /** Where the same-tab OAuth starts; null when the engine can't connect. */
  connectUrl(userId: string, platform: SocialPlatform, returnTo: string): Promise<string | null>;
  publishClip(userId: string, clipId: string, platform: SocialPlatform): Promise<{ ok: boolean }>;
}
