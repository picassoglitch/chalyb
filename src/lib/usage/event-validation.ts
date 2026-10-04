// Validation for engine-reported usage events (POST /api/engines/{slug}/usage).
// Contract: docs/engines/consumption-contract.md
//
// Pure, so it can be tested without a request. The bounds exist because
// every accepted event is money: an unbounded amount or cost, a batch of a
// million rows, or an event dated into last month (where this month's
// balance never sees it) would all be accepted as-is before.

export const MAX_EVENTS_PER_REQUEST = 100;
export const MAX_AMOUNT = 1e12;
/** $1,000 in one event is a bug, not a bill. */
export const MAX_COST_USD_MICROS = 1e9;
export const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const MAX_METADATA_BYTES = 4096;

// Loose format check for kind + provider: whitelisting values would mean
// every new meter requires a Chalyb deploy — see migration 0020.
const KIND_RE = /^[a-z][a-z0-9_.]{0,63}$/;
const PROVIDER_RE = /^[a-z][a-z0-9_.-]{0,63}$/;
const OPERATION_RE = /^[a-z][a-z0-9_.]{0,63}$/;
const SOURCE_ID_RE = /^[\s\S]{1,200}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ValidEvent {
  kind: string;
  amount: number;
  sourceId: string;
  occurredAt: string;
  operation?: string;
  metadata?: Record<string, unknown>;
  provider?: string;
  costUsdMicros?: number;
  reservationId?: string;
}

export type EventCheck =
  | { ok: true; events: ValidEvent[] }
  /** 400: malformed; 413: too many; 422: well-formed but not acceptable
   *  (out-of-window time, out-of-range number). Engines must not retry a
   *  4xx: they dead-letter it. */
  | { ok: false; status: 400 | 413 | 422; error: string; index?: number };

function isInt(v: unknown, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;
}

export function validateUsageEvents(raw: unknown, nowMs: number): EventCheck {
  if (!Array.isArray(raw)) return { ok: true, events: [] };
  if (raw.length > MAX_EVENTS_PER_REQUEST) {
    return {
      ok: false,
      status: 413,
      error: `at most ${MAX_EVENTS_PER_REQUEST} events per request`,
    };
  }

  const events: ValidEvent[] = [];
  for (let i = 0; i < raw.length; i++) {
    const e = raw[i] as Record<string, unknown> | null;
    const bad = (status: 400 | 422, error: string): EventCheck => ({
      ok: false,
      status,
      error,
      index: i,
    });
    if (!e || typeof e !== 'object') return bad(400, 'event must be an object');

    if (typeof e.kind !== 'string' || !KIND_RE.test(e.kind)) return bad(400, 'invalid kind');
    if (typeof e.source_id !== 'string' || !SOURCE_ID_RE.test(e.source_id)) {
      return bad(400, 'source_id required (≤200 chars)');
    }
    if (typeof e.amount !== 'number' || !Number.isFinite(e.amount))
      return bad(400, 'invalid amount');
    if (!isInt(e.amount, MAX_AMOUNT)) return bad(422, `amount must be an integer 0..${MAX_AMOUNT}`);

    if (
      e.cost_usd_micros !== undefined &&
      e.cost_usd_micros !== null &&
      !isInt(e.cost_usd_micros, MAX_COST_USD_MICROS)
    ) {
      return bad(422, `cost_usd_micros must be an integer 0..${MAX_COST_USD_MICROS}`);
    }
    if (
      e.provider !== undefined &&
      e.provider !== null &&
      (typeof e.provider !== 'string' || !PROVIDER_RE.test(e.provider))
    ) {
      return bad(400, 'invalid provider');
    }
    if (
      e.operation !== undefined &&
      e.operation !== null &&
      (typeof e.operation !== 'string' || !OPERATION_RE.test(e.operation))
    ) {
      return bad(400, 'invalid operation');
    }
    if (
      e.reservation_id !== undefined &&
      e.reservation_id !== null &&
      (typeof e.reservation_id !== 'string' || !UUID_RE.test(e.reservation_id))
    ) {
      return bad(400, 'invalid reservation_id');
    }

    let metadata: Record<string, unknown> | undefined;
    if (e.metadata !== undefined && e.metadata !== null) {
      if (typeof e.metadata !== 'object' || Array.isArray(e.metadata))
        return bad(400, 'metadata must be an object');
      if (JSON.stringify(e.metadata).length > MAX_METADATA_BYTES)
        return bad(422, 'metadata too large');
      metadata = e.metadata as Record<string, unknown>;
    }

    let occurredMs = nowMs;
    if (e.occurred_at !== undefined && e.occurred_at !== null) {
      occurredMs = typeof e.occurred_at === 'string' ? Date.parse(e.occurred_at) : NaN;
      if (Number.isNaN(occurredMs)) return bad(400, 'invalid occurred_at');
      if (occurredMs > nowMs + MAX_CLOCK_SKEW_MS) return bad(422, 'occurred_at is in the future');
      if (occurredMs < nowMs - MAX_EVENT_AGE_MS)
        return bad(422, 'occurred_at is older than 7 days');
    }

    events.push({
      kind: e.kind,
      amount: e.amount,
      sourceId: e.source_id,
      occurredAt: new Date(occurredMs).toISOString(),
      operation: typeof e.operation === 'string' ? e.operation : undefined,
      metadata,
      provider: typeof e.provider === 'string' ? e.provider : undefined,
      costUsdMicros: typeof e.cost_usd_micros === 'number' ? e.cost_usd_micros : undefined,
      reservationId: typeof e.reservation_id === 'string' ? e.reservation_id : undefined,
    });
  }
  return { ok: true, events };
}
