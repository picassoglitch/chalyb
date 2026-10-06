// The closed set of errors a customer can see (rebuild prompt P0-4).
//
// Server actions return `{ ok: false, code }` and nothing else: no message,
// no reason string, no detail. The detail (status, body, env names, request
// ids) goes to the server log where it was produced. The client turns the
// code into copy with `errors.tool.<code>` in messages/*.json.
//
// Pure: no imports, so client components and tests can use it.

export const CUSTOMER_ERROR_CODES = [
  'NEEDS_PLAN',
  'SETUP_NEEDED',
  'RISK_ACK_REQUIRED',
  'TOOL_UNAVAILABLE',
  'PROVISION_FAILED',
  'SESSION_EXPIRED',
  'NETWORK',
  'UNKNOWN',
] as const;

export type CustomerErrorCode = (typeof CUSTOMER_ERROR_CODES)[number];

export function isCustomerErrorCode(value: unknown): value is CustomerErrorCode {
  return typeof value === 'string' && (CUSTOMER_ERROR_CODES as readonly string[]).includes(value);
}

/** Reasons the engine integrations report (integrations/types.ts). */
export type IntegrationFailureReason =
  | 'not_configured'
  | 'engine_error'
  | 'auth_error'
  | 'duplicate'
  | 'network'
  | 'not_provisioned'
  | 'db_write_failed'
  | 'no_integration'
  | 'missing_profile_email';

/**
 * Integration failure → customer code. Every reason an integration can report
 * lands on a code; nothing passes its text through.
 *
 * - Provisioning failures (the engine refused or errored while creating the
 *   user's account there) are PROVISION_FAILED: the customer can retry.
 * - Wiring problems on our side (missing URL, secret or integration) are
 *   TOOL_UNAVAILABLE: retrying will not help, so we say "try in a few minutes"
 *   and the log says what to fix.
 */
export function codeForIntegrationFailure(
  reason: string | undefined,
  phase: 'provision' | 'launch',
): CustomerErrorCode {
  switch (reason as IntegrationFailureReason | undefined) {
    case 'not_configured':
    case 'no_integration':
    case 'auth_error':
      return 'TOOL_UNAVAILABLE';
    case 'network':
    case 'engine_error':
    case 'duplicate':
    case 'db_write_failed':
    case 'missing_profile_email':
    case 'not_provisioned':
      return phase === 'provision' ? 'PROVISION_FAILED' : 'TOOL_UNAVAILABLE';
    default:
      return 'UNKNOWN';
  }
}
