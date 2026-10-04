// The BFF call path (TOOLS-SPEC §1.2): every screen and /api/tools route
// reaches a tool through runTool, which
//   1. refuses fast while the tool's circuit breaker is open,
//   2. gives up after 8 s, retrying idempotent reads up to 2 times,
//   3. normalizes any failure to { reason, retryable, supportCode },
//   4. logs it to Actividad (audit 'tool.error') and feeds tool_status.
// Entitlements are checked by the caller (loadTool) before this runs.

import 'server-only';
import { randomInt } from 'node:crypto';
import { logAudit } from '@/lib/audit/log';
import { toolBySlug } from '@/config/tools';
import {
  breakerAfter,
  breakerAllows,
  closedBreaker,
  countsAsOutage,
  failureEffect,
  supportCode,
  ToolCircuitOpenError,
  ToolTimeoutError,
  TOOL_GET_RETRIES,
  TOOL_TIMEOUT_MS,
  type BreakerState,
  type ToolError,
  type ToolErrorReason,
  type ToolResult,
} from './bff-core';
import { recordToolHealth } from './status';

const store = globalThis as unknown as { __chalybBreakers?: Map<string, BreakerState> };
const breakers = () => (store.__chalybBreakers ??= new Map());

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ToolTimeoutError(`timed out after ${ms} ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** A support code for this tool, e.g. CLP-0427. */
export function newSupportCode(slug: string): string {
  return supportCode(toolBySlug(slug)?.supportPrefix ?? 'CLP', randomInt(0, 10_000) / 10_000);
}

/** Record a failure the person saw and return the error to show. */
export async function reportToolError(
  slug: string,
  userId: string,
  reason: ToolErrorReason,
  retryable: boolean,
  /** Whether this failure says the tool is down (feeds tool_status). */
  outage = countsAsOutage(reason),
): Promise<ToolError> {
  const error: ToolError = { reason, retryable, supportCode: newSupportCode(slug) };
  await logAudit({
    action: 'tool.error',
    targetUserId: userId,
    metadata: { tool: slug, reason, supportCode: error.supportCode },
  });
  if (outage && reason !== 'unavailable')
    await recordToolHealth(slug, { ok: false, latencyMs: TOOL_TIMEOUT_MS, reason }).catch(() => {});
  return error;
}

export async function runTool<T>(
  slug: string,
  userId: string,
  op: () => Promise<T>,
  opts: {
    idempotent?: boolean;
    /** Only errors the engine adapter threw (and timeouts) count against
     *  the breaker and health; the BFF routes set this (see bff-route). */
    adapterErrorsOnly?: boolean;
  } = {},
): Promise<ToolResult<T>> {
  const attempts = 1 + (opts.idempotent ? TOOL_GET_RETRIES : 0);
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    const now = Date.now();
    const b = breakers().get(slug) ?? closedBreaker();
    if (!breakerAllows(b, now)) {
      last = new ToolCircuitOpenError(slug);
      break;
    }
    try {
      const data = await withTimeout(op(), TOOL_TIMEOUT_MS);
      breakers().set(slug, breakerAfter(b, true, Date.now()));
      return { ok: true, data };
    } catch (err) {
      last = err;
      const { outage, retryable } = failureEffect(err, opts);
      if (outage) breakers().set(slug, breakerAfter(b, false, Date.now()));
      if (!retryable) break;
    }
  }
  const { reason, retryable, outage } = failureEffect(last, opts);
  return { ok: false, error: await reportToolError(slug, userId, reason, retryable, outage) };
}
