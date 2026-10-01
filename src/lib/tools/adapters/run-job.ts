// Job policy shared by every Clips adapter (BUILD-SPEC §4.2.5–6):
//
//   - Failures that might be transient are retried automatically, at most
//     MAX_AUTO_RETRIES times, before the customer sees an error.
//   - Failures that retrying can't fix (a private link, an unsupported site,
//     a video too long, no credits) are shown at once.
//   - Credits are charged only when a job finishes 'ready', and only once.
//   - Every failure the customer sees is logged with its reason.
//
// Pure over its dependencies, so the rules are unit-tested directly.

import type {
  ClipFailureReason,
  ClipJob,
  ClipsAdapter,
  CreateClipJobInput,
  CreateClipJobResult,
} from './types';

export const MAX_AUTO_RETRIES = 2;

const RETRYABLE: ReadonlySet<ClipFailureReason> = new Set(['platform_down', 'unknown']);

export function isRetryable(reason: ClipFailureReason | undefined): boolean {
  return reason !== undefined && RETRYABLE.has(reason);
}

export interface JobPolicyDeps {
  adapter: ClipsAdapter;
  /** Charge the user's credits for a finished job. */
  debit(job: ClipJob): Promise<void>;
  /** Log a failure the customer is about to see. */
  logFailure(job: {
    id: string | null;
    userId: string;
    reason: ClipFailureReason;
    attempts: number;
  }): void;
}

/** Submit a new job, retrying transient refusals. */
export async function submitClipJob(
  deps: JobPolicyDeps,
  input: CreateClipJobInput,
): Promise<CreateClipJobResult> {
  let result = await deps.adapter.createJob(input);
  let attempts = 1;
  while (!result.ok && isRetryable(result.reason) && attempts <= MAX_AUTO_RETRIES) {
    result = await deps.adapter.createJob(input);
    attempts += 1;
  }
  if (!result.ok) {
    deps.logFailure({ id: null, userId: input.userId, reason: result.reason, attempts });
  }
  return result;
}

/**
 * Read a job and apply the policy: resubmit a transient failure while retries
 * remain (the customer keeps seeing "creando"); then, exactly once per job,
 * charge credits for 'ready' or log the reason for a final 'failed'.
 */
export async function refreshClipJob(
  deps: JobPolicyDeps,
  userId: string,
  jobId: string,
): Promise<ClipJob | null> {
  const job = await deps.adapter.getJob(userId, jobId);
  if (!job) return null;

  if (job.state === 'failed' && isRetryable(job.reason) && job.attempts <= MAX_AUTO_RETRIES) {
    await deps.adapter.retryJob(userId, jobId);
    return (await deps.adapter.getJob(userId, jobId)) ?? job;
  }

  const finished = job.state === 'ready' || job.state === 'failed';
  if (!finished || job.settled) return job;

  // Claim the settlement first: only the reader that wins it charges or logs.
  if (await deps.adapter.markSettled(userId, jobId)) {
    if (job.state === 'ready') await deps.debit(job);
    else
      deps.logFailure({
        id: job.id,
        userId,
        reason: job.reason ?? 'unknown',
        attempts: job.attempts,
      });
  }
  return { ...job, settled: true };
}

/** Hosts Clips can read (BUILD-SPEC §7.6 `error.unsupported`). TODO(owner) Q4:
 *  confirm the list with the Clips team. */
const SUPPORTED_HOSTS = [
  'youtube.com',
  'youtu.be',
  'twitch.tv',
  'kick.com',
  'facebook.com',
  'fb.watch',
];

/** Validate a pasted link before any job exists. */
export function checkSourceUrl(
  raw: string,
): { ok: true; url: string } | { ok: false; reason: ClipFailureReason } {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return { ok: false, reason: 'link_unsupported' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, reason: 'link_unsupported' };
  }
  const host = parsed.hostname.toLowerCase().replace(/^(www|m)\./, '');
  const supported = SUPPORTED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  return supported
    ? { ok: true, url: parsed.toString() }
    : { ok: false, reason: 'link_unsupported' };
}
