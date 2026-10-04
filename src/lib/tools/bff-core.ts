// The app's BFF in front of each tool (TOOLS-SPEC §1.2): normalized errors,
// support codes, the circuit breaker and the health decision. Pure (the
// clock and the randomness come in as arguments), unit-tested.

export const TOOL_ERROR_REASONS = [
  'unavailable', // the hub has no adapter for this tool (no engine API yet)
  'timeout',
  'not_implemented',
  'circuit_open',
  'not_found',
  'forbidden',
  'risk_ack_required',
  'unknown',
] as const;
export type ToolErrorReason = (typeof TOOL_ERROR_REASONS)[number];

export interface ToolError {
  reason: ToolErrorReason;
  retryable: boolean;
  /** CLP/SEN/VIV + 4 digits, shown to the person and stored in Actividad. */
  supportCode: string;
}

export type ToolResult<T> = { ok: true; data: T } | { ok: false; error: ToolError };

export const TOOL_TIMEOUT_MS = 8000;
export const TOOL_GET_RETRIES = 2;
/** Consecutive failures that open the breaker, and how long it stays open. */
export const BREAKER_THRESHOLD = 5;
export const BREAKER_COOLDOWN_MS = 30_000;
/** Down this long → the owner is alerted and incident_active turns on. */
export const OWNER_ALERT_AFTER_MS = 5 * 60_000;

export class ToolTimeoutError extends Error {
  readonly code = 'TOOL_TIMEOUT';
}
export class ToolCircuitOpenError extends Error {
  readonly code = 'CIRCUIT_OPEN';
}

/** `CLP-0427`. `rand` is a number in [0, 1). */
export function supportCode(prefix: string, rand: number): string {
  const n = Math.floor(Math.min(Math.max(rand, 0), 0.9999) * 10_000);
  return `${prefix}-${String(n).padStart(4, '0')}`;
}

export function isSupportCode(s: string): boolean {
  return /^(CLP|SEN|VIV)-\d{4}$/.test(s);
}

/** What went wrong, in the BFF's words. Never the engine's raw message. */
export function normalizeToolError(err: unknown): Omit<ToolError, 'supportCode'> {
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
  switch (code) {
    case 'TOOL_TIMEOUT':
      return { reason: 'timeout', retryable: true };
    case 'CIRCUIT_OPEN':
      return { reason: 'circuit_open', retryable: true };
    case 'NOT_IMPLEMENTED':
      return { reason: 'not_implemented', retryable: false };
    case 'NOT_FOUND':
      return { reason: 'not_found', retryable: false };
    case 'FORBIDDEN':
      return { reason: 'forbidden', retryable: false };
    case 'RISK_ACK_REQUIRED':
      return { reason: 'risk_ack_required', retryable: false };
    default:
      return { reason: 'unknown', retryable: true };
  }
}

/** HTTP status the BFF route answers with for a reason. */
export function statusForReason(reason: ToolErrorReason): number {
  switch (reason) {
    case 'not_found':
      return 404;
    case 'forbidden':
    case 'risk_ack_required':
      return 403;
    case 'not_implemented':
    case 'unavailable':
    case 'circuit_open':
      return 503;
    case 'timeout':
      return 504;
    default:
      return 502;
  }
}

/** Whether a failure counts against the tool's health (a missing clip or a
 *  missing risk notice is the person's state, not an outage). */
export function countsAsOutage(reason: ToolErrorReason): boolean {
  return !['not_found', 'forbidden', 'risk_ack_required'].includes(reason);
}

// ── Circuit breaker (one per tool, per server process) ───────────────────
export interface BreakerState {
  failures: number;
  openedAt: number | null;
}

export const closedBreaker = (): BreakerState => ({ failures: 0, openedAt: null });

/** Whether a call may go through at `now`. After the cooldown one trial
 *  call is let through (half-open). */
export function breakerAllows(s: BreakerState, now: number): boolean {
  return s.openedAt === null || now - s.openedAt >= BREAKER_COOLDOWN_MS;
}

export function breakerAfter(s: BreakerState, ok: boolean, now: number): BreakerState {
  if (ok) return closedBreaker();
  const failures = s.failures + 1;
  return { failures, openedAt: failures >= BREAKER_THRESHOLD ? now : s.openedAt };
}

// ── Health (tool_status) ─────────────────────────────────────────────────
export type ToolHealthState = 'ok' | 'slow' | 'down';

export interface ToolStatusRow {
  state: ToolHealthState;
  downSince: string | null;
  incidentActive: boolean;
  incidentSince: string | null;
  alertedAt: string | null;
}

export const okStatus = (): ToolStatusRow => ({
  state: 'ok',
  downSince: null,
  incidentActive: false,
  incidentSince: null,
  alertedAt: null,
});

/** Slow when a healthy answer takes over half the timeout. */
export const SLOW_AFTER_MS = TOOL_TIMEOUT_MS / 2;

/**
 * The next tool_status after a health check, and whether to alert the owner
 * now. The alert goes once per outage, after it lasts OWNER_ALERT_AFTER_MS;
 * only a delivered alert turns incident_active on (§7.1: never promise
 * "ya nos avisaron" unless someone was told). Recovery clears the outage but
 * leaves an owner-set incident for the owner to close.
 */
export function nextToolStatus(
  prev: ToolStatusRow,
  check: { ok: boolean; latencyMs: number },
  nowIso: string,
): { next: ToolStatusRow; alertOwner: boolean } {
  if (check.ok) {
    return {
      next: {
        ...prev,
        state: check.latencyMs > SLOW_AFTER_MS ? 'slow' : 'ok',
        downSince: null,
        alertedAt: null,
        incidentActive: prev.alertedAt ? false : prev.incidentActive,
        incidentSince: prev.alertedAt ? null : prev.incidentSince,
      },
      alertOwner: false,
    };
  }
  const downSince = prev.downSince ?? nowIso;
  const longEnough = Date.parse(nowIso) - Date.parse(downSince) >= OWNER_ALERT_AFTER_MS;
  return {
    next: { ...prev, state: 'down', downSince },
    alertOwner: longEnough && !prev.alertedAt,
  };
}

/** After the owner alert was delivered. */
export function afterOwnerAlert(s: ToolStatusRow, nowIso: string): ToolStatusRow {
  return {
    ...s,
    alertedAt: nowIso,
    incidentActive: true,
    incidentSince: s.incidentSince ?? nowIso,
  };
}
