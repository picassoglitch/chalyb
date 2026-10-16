// HTTP client for the Clips engine's hub API (ChalyClip /api/hub/v1).
//
//   const engine = clipsEngine(userId);
//   const streams = await engine.get<StreamsPage>('/streams', { query: { limit: 20 }, signal });
//
// Every call: resolve the person's engine identity (api-identity.ts) →
// mint a fresh short-lived launch token → HTTPS with
// `Authorization: Bearer <token>` → parse JSON, or throw ClipsEngineError
// (errors.ts) that the BFF normalizes. The browser never sees the token,
// the engine URL or an engine error body.
//
// Shared by every Clips module (core, editor*, publish*): add endpoints as
// functions over `ClipsEngine`, never a second client.

import 'server-only';
import { mintEngineApiToken } from '@/lib/engines/integrations/api-token';
import { forgetEngineIdentity, resolveEngineIdentity } from '@/lib/engines/api-identity';
import { markAdapterError } from '@/lib/tools/bff-core';
import { ClipsEngineError, engineErrorFrom } from './errors';

export const CLIPS_SLUG = 'chalybclip';
export const CLIPS_API_PREFIX = '/api/hub/v1';
/** Optional override for the engine's API origin (else engines.external_url). */
export const CLIPS_API_BASE_ENV = 'CHALYBCLIP_API_BASE';

type Query = Record<string, string | number | boolean | null | undefined>;

export interface EngineCallOpts {
  query?: Query;
  /** JSON-serialized. */
  body?: unknown;
  signal?: AbortSignal;
  /** Return the raw Response (redirects not followed) instead of JSON. */
  raw?: boolean;
  /** Extra request headers (e.g. Range for media). Never overrides
   *  Authorization, Accept or Content-Type. */
  headers?: Record<string, string>;
}

export interface ClipsEngine {
  readonly userId: string;
  request<T>(method: string, path: string, opts?: EngineCallOpts): Promise<T>;
  get<T>(path: string, opts?: Omit<EngineCallOpts, 'body'>): Promise<T>;
  post<T>(path: string, body?: unknown, opts?: Omit<EngineCallOpts, 'body'>): Promise<T>;
  put<T>(path: string, body?: unknown, opts?: Omit<EngineCallOpts, 'body'>): Promise<T>;
  patch<T>(path: string, body?: unknown, opts?: Omit<EngineCallOpts, 'body'>): Promise<T>;
  del<T>(path: string, opts?: Omit<EngineCallOpts, 'body'>): Promise<T>;
  /** Absolute URL for a signed media path the engine returned
   *  (`/api/hub/media/...`, see ChalyClip api/hub_media.py). The browser
   *  loads it directly (video/img/download): media never goes through the
   *  hub. Anything else → null. */
  mediaUrl(path: string | null | undefined): Promise<string | null>;
}

export const MEDIA_PATH_PREFIX = '/api/hub/media/';

/** `${baseUrl}${path}` for an engine media path, else null. Pure. */
export function absoluteMediaUrl(baseUrl: string, path: string | null | undefined): string | null {
  if (typeof path !== 'string' || !path.startsWith(MEDIA_PATH_PREFIX) || path.includes('..'))
    return null;
  return `${baseUrl}${path}`;
}

/** Dependencies, injectable for tests. */
export interface ClipsEngineDeps {
  fetch: typeof fetch;
  identity: (userId: string) => Promise<{
    userId: string;
    email: string;
    tenantId: string;
    tier: string;
    baseUrl: string;
  }>;
  mint: (claims: { user_id: string; email: string; tenant_id: string; tier: string }) => string;
  forget: (userId: string) => void;
}

const defaultDeps = (): ClipsEngineDeps => ({
  fetch: (...a) => fetch(...a),
  identity: (userId) =>
    resolveEngineIdentity(CLIPS_SLUG, userId, { baseUrlEnv: CLIPS_API_BASE_ENV }),
  mint: (claims) => mintEngineApiToken(CLIPS_SLUG, claims),
  forget: (userId) => forgetEngineIdentity(CLIPS_SLUG, userId),
});

export function buildEngineUrl(baseUrl: string, path: string, query?: Query): string {
  if (!path.startsWith('/') || path.includes('..') || path.includes('//'))
    throw new Error(`bad engine path ${path}`);
  const url = new URL(`${baseUrl}${CLIPS_API_PREFIX}${path}`);
  for (const [k, v] of Object.entries(query ?? {}))
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  return url.toString();
}

/** A path segment from an id, encoded (ids never contain '/'). */
export const seg = (id: string | number): string => encodeURIComponent(String(id));

/** The engine client acting as `userId`. Every error it throws is marked as
 *  an engine error, so it counts against the breaker/health wherever the
 *  call was made from (bff-core markAdapterError). */
export function clipsEngine(userId: string, deps: ClipsEngineDeps = defaultDeps()): ClipsEngine {
  async function request<T>(method: string, path: string, opts: EngineCallOpts = {}): Promise<T> {
    try {
      return await send<T>(method, path, opts);
    } catch (err) {
      throw markAdapterError(err);
    }
  }
  async function send<T>(method: string, path: string, opts: EngineCallOpts): Promise<T> {
    const id = await deps.identity(userId);
    const token = deps.mint({
      user_id: id.userId,
      email: id.email,
      tenant_id: id.tenantId,
      tier: id.tier,
    });
    const headers: Record<string, string> = {
      ...opts.headers,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    };
    let body: string | undefined;
    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }
    let res: Response;
    try {
      res = await deps.fetch(buildEngineUrl(id.baseUrl, path, opts.query), {
        method,
        headers,
        body,
        signal: opts.signal,
        cache: 'no-store',
        redirect: 'manual',
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err;
      throw new ClipsEngineError('network', 0);
    }
    if (opts.raw && res.status < 400) return res as unknown as T;
    if (res.status >= 400) {
      const parsed = await res.json().catch(() => null);
      // A 401 means our token was refused: the cached identity (tenant id,
      // tier) may be stale — re-resolve on the next call.
      if (res.status === 401) deps.forget(userId);
      throw engineErrorFrom(res.status, parsed);
    }
    if (res.status === 204) return undefined as T;
    try {
      return (await res.json()) as T;
    } catch {
      throw new ClipsEngineError('bad_response', res.status);
    }
  }
  return {
    userId,
    request,
    get: (path, opts) => request('GET', path, opts),
    post: (path, body, opts) => request('POST', path, { ...opts, body }),
    put: (path, body, opts) => request('PUT', path, { ...opts, body }),
    patch: (path, body, opts) => request('PATCH', path, { ...opts, body }),
    del: (path, opts) => request('DELETE', path, opts),
    mediaUrl: async (path) => {
      if (!absoluteMediaUrl('', path)) return null;
      return absoluteMediaUrl((await deps.identity(userId)).baseUrl, path);
    },
  };
}
