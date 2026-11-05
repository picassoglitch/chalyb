// Protected dependency checks. No jobs, tenant provisioning, emails or writes.
import { timingSafeEqual } from 'node:crypto';

export const READINESS_TIMEOUT_MS = 8000;
export const READINESS_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0' };

export interface ReadinessEngine {
  slug: string;
  status: string;
  external_url: string | null;
}

export interface ReadinessDeps {
  secret: string | undefined;
  readCatalog: (signal: AbortSignal) => Promise<ReadinessEngine[]>;
  probe: (engine: ReadinessEngine, signal: AbortSignal) => Promise<void>;
  publicSlugs: ReadonlySet<string>;
  timeoutMs?: number;
}

export function healthAuthorized(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const got = Buffer.from(request.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Bound the whole operation even if a dependency ignores cancellation. */
export async function healthDeadline<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs = READINESS_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(() => run(controller.signal)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('timeout'));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

// Our own snake_case codes are safe to log; foreign errors may carry URLs, so log only their name.
function failureCode(err: unknown): string {
  if (!(err instanceof Error)) return 'unknown';
  return /^[a-z_]+$/.test(err.message) ? err.message : err.name;
}

export async function readinessResponse(request: Request, deps: ReadinessDeps): Promise<Response> {
  if (!healthAuthorized(request, deps.secret)) {
    return Response.json({ ok: false }, { status: 401, headers: READINESS_HEADERS });
  }
  try {
    const result = await healthDeadline(async (signal) => {
      const catalog = await deps.readCatalog(signal);
      const active = catalog.filter((e) => e.status === 'active' && deps.publicSlugs.has(e.slug));
      const engines: Record<string, boolean> = {};
      await Promise.all(
        active.map(async (engine) => {
          try {
            await deps.probe(engine, signal);
            engines[engine.slug] = true;
          } catch (err) {
            engines[engine.slug] = false;
            console.error('[ready] probe_failed', engine.slug, failureCode(err));
          }
        }),
      );
      const ok = active.length > 0 && Object.values(engines).every(Boolean);
      return { ok, checks: { database: true, activeTools: active.length > 0, engines } };
    }, deps.timeoutMs);
    return Response.json(
      { ...result, status: result.ok ? 'ready' : 'not_ready' },
      { status: result.ok ? 200 : 503, headers: READINESS_HEADERS },
    );
  } catch (err) {
    console.error('[ready] not_ready', failureCode(err));
    // No dependency URLs, provider errors or credentials in the response.
    return Response.json(
      { ok: false, status: 'not_ready' },
      { status: 503, headers: READINESS_HEADERS },
    );
  }
}

/** Only these documented read-only engine endpoints may be probed. */
export async function probePublicEngine(
  engine: ReadinessEngine,
  signal: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (!engine.external_url) throw new Error('missing_engine_url');
  const base = new URL(engine.external_url);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) {
    throw new Error('invalid_engine_url');
  }
  const path =
    engine.slug === 'chalybclip'
      ? '/readyz'
      : engine.slug === 'chalybobs'
        ? '/api/hub/v1/state'
        : null;
  if (!path) throw new Error('unmonitored_engine');
  const response = await fetchImpl(
    new URL(`${base.origin}${base.pathname.replace(/\/+$/, '')}${path}`),
    {
      signal,
      cache: 'no-store',
      redirect: 'manual',
      headers: { Accept: 'application/json' },
    },
  );
  try {
    if (engine.slug === 'chalybclip') {
      if (response.status !== 200) throw new Error('engine_unready');
      const body: unknown = await response.json();
      if (!body || typeof body !== 'object' || !('status' in body) || body.status !== 'ready') {
        throw new Error('engine_unready');
      }
    } else if (response.status !== 401) {
      // En vivo's protected state endpoint refuses anonymous requests with 401.
      // This checks API reachability only, not relay or OAuth operation.
      throw new Error('engine_unreachable');
    }
  } finally {
    await response.body?.cancel().catch(() => {});
  }
}

/** The cron must contact the real engine in mode a, never its static UI capabilities. */
export function clipsHealthProbe(
  mode: string,
  deps: {
    readEngine: (signal: AbortSignal) => Promise<ReadinessEngine>;
    capabilities: () => unknown;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  },
): (() => Promise<void>) | null {
  if (mode === 'a') {
    return () =>
      healthDeadline(async (signal) => {
        const engine = await deps.readEngine(signal);
        await probePublicEngine(engine, signal, deps.fetchImpl);
      }, deps.timeoutMs);
  }
  if (mode === 'mock')
    return async () => {
      await deps.capabilities();
    };
  return null;
}

/** Match the real adapters' API override precedence, without provisioning a user. */
export function readinessEngineTarget(
  engine: ReadinessEngine,
  env: Record<string, string | undefined>,
): ReadinessEngine {
  const override =
    engine.slug === 'chalybclip'
      ? env.CHALYBCLIP_API_BASE
      : engine.slug === 'chalybobs'
        ? env.CHALYBOBS_API_BASE?.trim()
        : undefined;
  return {
    ...engine,
    external_url: (override || engine.external_url || '').replace(/\/+$/, '') || null,
  };
}
