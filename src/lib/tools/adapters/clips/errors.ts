// Clips engine errors → the BFF's normalized tool errors (bff-core.ts).
//
// The engine's /api/hub/v1 answers every failure as
//   { ok: false, error: { code, message, reason, retryable } }
// (ChalyClip chalybclip/api/hub_api.py — keep HUB_ERROR_CODES in sync).
// This maps it onto the `code` property normalizeToolError reads, so a
// refusal (no credits, plan caps, file too large) reaches the screen as the
// person's state, and only engine trouble counts as an outage.
//
// Pure: no imports with side effects, unit-tested.

/** Codes the engine sends (chalybclip/api/hub_api.py HUB_ERROR_CODES). */
export const ENGINE_ERROR_CODES = [
  'bad_request',
  'unauthorized',
  'no_credits',
  'needs_plan',
  'forbidden',
  'not_found',
  'conflict',
  'too_large',
  'rate_limited',
  'internal',
  'unavailable',
] as const;
export type EngineErrorCode = (typeof ENGINE_ERROR_CODES)[number];

/** The `code` bff-core's normalizeToolError switches on. */
const BFF_CODE: Record<EngineErrorCode, string> = {
  bad_request: 'BAD_REQUEST',
  conflict: 'BAD_REQUEST',
  unauthorized: 'ENGINE_AUTH', // hub↔engine secret/identity problem: an outage
  no_credits: 'NO_CREDITS',
  needs_plan: 'NEEDS_PLAN',
  forbidden: 'FORBIDDEN',
  not_found: 'NOT_FOUND',
  too_large: 'TOO_LARGE',
  rate_limited: 'RATE_LIMITED',
  internal: 'ENGINE_ERROR',
  unavailable: 'ENGINE_ERROR',
};

/** An engine refusal or failure. `code` drives normalizeToolError;
 *  `refusal` is the engine's machine reason (minutes_cap, no_tokens,
 *  paywall_paid…) so a screen can pick precise copy; `userMessage` is the
 *  engine's Spanish copy, for logs and screens that choose to show it. */
export class ClipsEngineError extends Error {
  readonly code: string;
  constructor(
    readonly engineCode: EngineErrorCode | 'network' | 'bad_response',
    readonly status: number,
    readonly refusal: string | null = null,
    readonly userMessage: string | null = null,
  ) {
    super(`clips engine ${status} ${engineCode}${refusal ? ` (${refusal})` : ''}`);
    this.code =
      engineCode === 'network' || engineCode === 'bad_response'
        ? 'ENGINE_ERROR'
        : BFF_CODE[engineCode];
  }
}

function isEngineCode(v: unknown): v is EngineErrorCode {
  return typeof v === 'string' && (ENGINE_ERROR_CODES as readonly string[]).includes(v);
}

/** Fallback when the body isn't the hub format (proxy page, crash). */
export function codeForStatus(status: number): EngineErrorCode {
  switch (status) {
    case 400:
    case 422:
      return 'bad_request';
    case 401:
      return 'unauthorized';
    case 402:
      return 'no_credits';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 409:
      return 'conflict';
    case 413:
      return 'too_large';
    case 429:
      return 'rate_limited';
    case 503:
      return 'unavailable';
    default:
      return status >= 400 && status < 500 ? 'bad_request' : 'internal';
  }
}

const SAFE_REASON = /^[a-z][a-z0-9_]{0,47}$/;

/** Build the error for a non-2xx engine answer from its status and body. */
export function engineErrorFrom(status: number, body: unknown): ClipsEngineError {
  const err =
    body && typeof body === 'object' && 'error' in body
      ? ((body as { error: unknown }).error as Record<string, unknown> | null)
      : null;
  const code = err && isEngineCode(err.code) ? err.code : codeForStatus(status);
  const reason =
    err && typeof err.reason === 'string' && SAFE_REASON.test(err.reason) ? err.reason : null;
  const message = err && typeof err.message === 'string' ? err.message.slice(0, 400) : null;
  return new ClipsEngineError(code, status, reason, message);
}
