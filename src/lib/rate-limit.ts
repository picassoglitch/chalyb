// Rate limiting that survives more than one instance.
//
// THE PROBLEM WITH THE IN-MEMORY VERSION
// The contact form counted submissions in a module-level Map. On Vercel that
// Map lives inside ONE serverless instance: a burst spreads across instances
// and each one starts from zero, a cold start wipes the counts, and nothing
// is shared between regions. The limit read as "5 per 10 minutes" and behaved
// closer to "5 per instance per 10 minutes, until the next deploy".
//
// THE FIX
// Upstash Redis over its REST API when it is configured — no TCP client, no
// new runtime dependency, just fetch — with the in-memory bucket kept as the
// fallback for local development and for deployments that have not set the
// two env vars. The fallback is honest about what it is: it still deters the
// casual case, and `backend` in the result says which one answered so a
// caller can log it.
//
// CONFIGURE (Vercel → the project's env vars, or .env.local):
//   UPSTASH_REDIS_REST_URL    https://<name>.upstash.io
//   UPSTASH_REDIS_REST_TOKEN  the REST token from the Upstash console
//
// The algorithm is a fixed window: INCR a key named for the window, and set
// the TTL on the first hit. One round trip in the common case, and no
// coordination needed between callers.

import 'server-only';

export interface RateLimitResult {
  /** False when the caller is over the limit and should be refused. */
  allowed: boolean;
  /** Hits recorded in the current window, including this one. */
  count: number;
  /** Which store answered — useful when a log needs to say how much the
   *  verdict is worth. */
  backend: 'redis' | 'memory';
}

export interface RateLimitOptions {
  /** Identifies the caller — an IP, a user id, whatever is being limited. */
  key: string;
  /** Namespace, so two limiters cannot collide on the same key. */
  scope: string;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Hits allowed per window. */
  max: number;
}

function isRedisConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

// ── In-memory fallback ────────────────────────────────────────────────────

const memoryBuckets = new Map<string, number[]>();

function memoryLimit(opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const mapKey = `${opts.scope}:${opts.key}`;
  const hits = (memoryBuckets.get(mapKey) ?? []).filter((t) => now - t < opts.windowMs);

  if (hits.length >= opts.max) {
    memoryBuckets.set(mapKey, hits);
    return { allowed: false, count: hits.length, backend: 'memory' };
  }

  hits.push(now);
  memoryBuckets.set(mapKey, hits);

  // Opportunistic sweep so a long-lived instance does not grow a bucket per
  // IP forever. Cheap: it only runs when the map is already large.
  if (memoryBuckets.size > 5_000) {
    for (const [k, v] of memoryBuckets) {
      if (v.every((t) => now - t >= opts.windowMs)) memoryBuckets.delete(k);
    }
  }

  return { allowed: true, count: hits.length, backend: 'memory' };
}

// ── Upstash REST ──────────────────────────────────────────────────────────

async function redisCommand(command: (string | number)[]): Promise<unknown> {
  const url = process.env.UPSTASH_REDIS_REST_URL!.replace(/\/+$/, '');
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    // A rate limiter must never be cached, and must never hold a request
    // open: if Redis is slow, fall back rather than stall the form.
    cache: 'no-store',
    signal: AbortSignal.timeout(2_000),
  });

  if (!res.ok) {
    throw new Error(`upstash ${res.status} ${res.statusText}`);
  }
  const payload = (await res.json()) as { result?: unknown; error?: string };
  if (payload.error) throw new Error(payload.error);
  return payload.result;
}

async function redisLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  // Fixed window: every key in the same window shares a bucket name, so the
  // window rolls over on its own and the TTL cleans up after it.
  const windowIndex = Math.floor(Date.now() / opts.windowMs);
  const redisKey = `ratelimit:${opts.scope}:${opts.key}:${windowIndex}`;

  const incremented = await redisCommand(['INCR', redisKey]);
  const count = typeof incremented === 'number' ? incremented : Number(incremented ?? 0);

  if (count === 1) {
    // First hit in this window — give the key a TTL so it disappears. Failing
    // to set it would leak one key per window per caller, so it is worth the
    // second round trip, but not worth failing the request over.
    try {
      await redisCommand(['PEXPIRE', redisKey, opts.windowMs]);
    } catch (err) {
      console.warn('[rate-limit] could not set TTL:', err);
    }
  }

  return { allowed: count <= opts.max, count, backend: 'redis' };
}

/**
 * Record a hit and say whether it is allowed.
 *
 * Never throws: a Redis outage degrades to the in-memory bucket rather than
 * taking the surface being protected down with it.
 */
export async function rateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  if (!isRedisConfigured()) return memoryLimit(opts);
  try {
    return await redisLimit(opts);
  } catch (err) {
    console.warn('[rate-limit] redis unavailable, falling back to in-memory:', err);
    return memoryLimit(opts);
  }
}
