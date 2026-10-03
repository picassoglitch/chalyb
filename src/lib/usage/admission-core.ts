// Admission rules an engine's job must pass before it spends anything.
// Contract: docs/engines/consumption-contract.md
//
// Pure (no I/O) so the rules are testable: this file decides the per-item
// caps (file size, video length, storage), the lane and the boost fee, and
// shapes the tier's aggregate caps for admit_usage() (migration 0046),
// which does the counting that has to be atomic.

import { BOOST_FEE_TOKENS, type TierCapabilities } from '@/lib/billing/tiers';

export type AdmitClass = 'job' | 'stream';
export type Lane = 'standard' | 'boost';

export type RefusalReason =
  | 'upload_too_large'
  | 'video_too_long'
  | 'storage_full'
  | 'minutes_cap'
  | 'jobs_cap'
  | 'concurrency'
  | 'streams_cap'
  | 'no_tokens'
  | 'boost_unavailable'
  | 'already_settled';

export interface AdmitRequest {
  externalJobId: string;
  class: AdmitClass;
  operation: string | null;
  estTokens: number;
  uploadMb: number;
  sourceMinutes: number;
  storageMbAfter: number | null;
  /** true = asked for boost, false = never, null = the tier's default. */
  boost: boolean | null;
  ttlSeconds: number;
}

export const DEFAULT_TTL_SECONDS = 3 * 60 * 60;
const MAX_TTL_SECONDS = 24 * 60 * 60;
const MAX_EST_TOKENS = 1e11;

const ID_RE = /^[A-Za-z0-9_.:-]{1,128}$/;
const OP_RE = /^[a-z][a-z0-9_.]{0,63}$/;

/** Validates the engine's admit body. Returns an error string or the request. */
export function parseAdmitBody(body: unknown): AdmitRequest | string {
  if (!body || typeof body !== 'object') return 'invalid JSON body';
  const b = body as Record<string, unknown>;

  if (typeof b.external_job_id !== 'string' || !ID_RE.test(b.external_job_id)) {
    return 'external_job_id required ([A-Za-z0-9_.:-], ≤128)';
  }
  const cls = b.class ?? 'job';
  if (cls !== 'job' && cls !== 'stream') return 'class must be job or stream';
  if (
    b.operation !== undefined &&
    b.operation !== null &&
    (typeof b.operation !== 'string' || !OP_RE.test(b.operation))
  ) {
    return 'invalid operation';
  }

  const num = (v: unknown, name: string, max: number): number | string => {
    if (v === undefined || v === null) return 0;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max) {
      return `invalid ${name}`;
    }
    return v;
  };
  const est = num(b.est_tokens, 'est_tokens', MAX_EST_TOKENS);
  const upload = num(b.upload_mb, 'upload_mb', 1e7);
  const minutes = num(b.source_minutes, 'source_minutes', 1e6);
  if (typeof est === 'string') return est;
  if (typeof upload === 'string') return upload;
  if (typeof minutes === 'string') return minutes;

  let storage: number | null = null;
  if (b.storage_mb_after !== undefined && b.storage_mb_after !== null) {
    const s = num(b.storage_mb_after, 'storage_mb_after', 1e9);
    if (typeof s === 'string') return s;
    storage = s;
  }

  if (b.boost !== undefined && b.boost !== null && typeof b.boost !== 'boolean') {
    return 'boost must be true, false or null';
  }

  let ttl = DEFAULT_TTL_SECONDS;
  if (b.ttl_seconds !== undefined && b.ttl_seconds !== null) {
    if (
      typeof b.ttl_seconds !== 'number' ||
      !Number.isInteger(b.ttl_seconds) ||
      b.ttl_seconds < 60 ||
      b.ttl_seconds > MAX_TTL_SECONDS
    ) {
      return 'ttl_seconds must be an integer between 60 and 86400';
    }
    ttl = b.ttl_seconds;
  }

  return {
    externalJobId: b.external_job_id,
    class: cls,
    operation: typeof b.operation === 'string' ? b.operation : null,
    estTokens: Math.ceil(est),
    uploadMb: upload,
    sourceMinutes: minutes,
    storageMbAfter: storage,
    boost: (b.boost as boolean | null | undefined) ?? null,
    ttlSeconds: ttl,
  };
}

/** Infinity (uncapped) → -1, the SQL side's "no cap". */
function capNum(n: number): number {
  return Number.isFinite(n) ? n : -1;
}

/** The numbers an engine should size its UI and uploads by. */
export function publicLimits(caps: TierCapabilities) {
  return {
    max_upload_mb: capNum(caps.maxUploadMB),
    max_source_minutes: capNum(caps.maxSourceMinutes),
    source_minutes_per_month: capNum(caps.sourceMinutesPerMonth),
    max_concurrent_jobs: capNum(caps.maxConcurrentJobs),
    jobs_per_month: capNum(caps.jobsPerMonth),
    storage_mb: capNum(caps.storageMB),
    active_streams: capNum(caps.activeStreams),
    boost: caps.boost,
    boost_fee_tokens: caps.boost === 'included' ? 0 : BOOST_FEE_TOKENS,
  };
}

/** Per-item caps: things the engine measured about this one job. */
export function checkItemCaps(
  req: AdmitRequest,
  caps: TierCapabilities,
  unlimited: boolean,
): RefusalReason | null {
  if (unlimited) return null;
  if (req.uploadMb > caps.maxUploadMB) return 'upload_too_large';
  if (req.sourceMinutes > caps.maxSourceMinutes) return 'video_too_long';
  if (req.storageMbAfter !== null && req.storageMbAfter > caps.storageMB) return 'storage_full';
  return null;
}

/** Which lane the job runs on and what that costs the user. Streams never
 *  boost — the relay, not a batch machine, carries them. */
export function resolveLane(
  req: Pick<AdmitRequest, 'boost' | 'class'>,
  caps: TierCapabilities,
  unlimited: boolean,
): { lane: Lane; feeTokens: number } {
  if (req.class === 'stream' || req.boost === false) return { lane: 'standard', feeTokens: 0 };
  if (caps.boost === 'included' || unlimited) {
    return { lane: 'boost', feeTokens: 0 };
  }
  // Paid tiers boost only when asked.
  return req.boost === true
    ? { lane: 'boost', feeTokens: BOOST_FEE_TOKENS }
    : { lane: 'standard', feeTokens: 0 };
}

/** The tier's aggregate caps as admit_usage() reads them. */
export function sqlCaps(caps: TierCapabilities, allocation: number, unlimited: boolean) {
  return {
    allocation: capNum(allocation),
    unlimited,
    jobs_per_month: capNum(caps.jobsPerMonth),
    minutes_per_month: capNum(caps.sourceMinutesPerMonth),
    max_concurrent_jobs: capNum(caps.maxConcurrentJobs),
    active_streams: capNum(caps.activeStreams),
    streams_per_month: capNum(caps.clipStreamsPerMonth),
  };
}

/** Engines estimate a job's provider cost in raw cost tokens
 *  (cost_usd_micros / 4); what it will actually draw is that plus the
 *  margin. Reserving the raw figure let a job reserve ~3× less than it
 *  spends (a 1.4-min test run: 22.6k reserved, 70.4k billed). */
export function reserveWithMargin(estTokens: number, marginPercent: number): number {
  return Math.ceil(estTokens * (1 + Math.max(0, marginPercent) / 100));
}
