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
  /** How many times the job has been submitted (1 + automatic retries). */
  attempts: number;
  /** Whether the hub has applied its policy to the finished job: charged
   *  credits for 'ready', logged the reason for 'failed'. Done exactly once. */
  settled: boolean;
  createdAt: string;
}

export interface CreateClipJobInput {
  userId: string;
  sourceUrl: string;
  format: ClipFormat;
  count: ClipCount;
}

export type CreateClipJobResult =
  | { ok: true; jobId: string }
  | { ok: false; reason: ClipFailureReason };

export interface ClipsAdapter {
  createJob(input: CreateClipJobInput): Promise<CreateClipJobResult>;
  /** Null when the job doesn't exist or belongs to another user. */
  getJob(userId: string, jobId: string): Promise<ClipJob | null>;
  /** Resubmit a failed job in place (same id). */
  retryJob(userId: string, jobId: string): Promise<void>;
  /** Atomically mark a finished job settled (see ClipJob.settled). Returns
   *  true only for the one call that flipped it, so concurrent readers can't
   *  charge twice. */
  markSettled(userId: string, jobId: string): Promise<boolean>;
}
