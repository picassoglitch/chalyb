// The plan's per-video limits on the upload screen. Pure, so tests read the
// same rule the form applies.

import { errorText, ToolCallError, type ErrorCopy } from './tool-call';

export interface UploadLimitCopy {
  /** "Tu plan Gratis permite videos de hasta 5 minutos." null = no length cap. */
  tooLong: string | null;
  /** The month's videos are used (engine refusal videos_cap). */
  monthUsed: string | null;
}

/** Longer than the plan takes, in minutes rounded to 2 decimals as the hub
 *  checks them (unknown length: the engine decides). */
export function overLength(seconds: number | null, maxSeconds: number | null): boolean {
  if (seconds === null || maxSeconds === null) return false;
  return Math.round((seconds / 60) * 100) / 100 > maxSeconds / 60;
}

/** One sentence for a failed upload: the plan's own words for its limits. */
export function uploadErrorText(err: unknown, copy: ErrorCopy, limits: UploadLimitCopy): string {
  if (err instanceof ToolCallError) {
    if (err.refusal === 'video_too_long' && limits.tooLong) return limits.tooLong;
    if (err.refusal === 'videos_cap' && limits.monthUsed) return limits.monthUsed;
  }
  return errorText(err, copy);
}
