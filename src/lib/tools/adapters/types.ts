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
  // Hub-side: the source was removed after a copyright notice and can't be
  // uploaded again (Uso aceptable §5.2.3). Refused before the engine sees it.
  'content_blocked',
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
}
