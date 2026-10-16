// En vivo's engine adapter (TOOL_HUB_MODE_CHALYBOBS=a): every method is one
// HTTPS call to the engine's hub API (/api/hub/v1, ChalyOBS) with a
// per-request Bearer minted for the signed-in person. Who the person is (and
// their engine tenant) comes from `resolve`, never from the browser.
//
// Pure apart from `fetch` (injected), so it is unit-tested end to end
// against a fake engine. The server wiring lives in envivo-engine.ts.

import { API_AUD, PREVIEW_AUD, mintEngineToken } from '../envivo-token';
import {
  isPlatformId,
  normalizeBroadcastMeta,
  OAUTH_PLATFORMS,
  type BroadcastMeta,
  type OAuthPlatform,
} from '../envivo-platforms';
import {
  EnVivoRefusal,
  type DestinationPatch,
  type DestinationStatus,
  type EnVivoAdapter,
  type LiveDestination,
  type LiveState,
  type PastStream,
} from './tools';

export interface EngineWho {
  userId: string;
  email: string;
  /** Engine tenant (engine_subscriptions.external_user_id). */
  tenantId: string;
  /** Lower-case plan as the launch token carries it ('vip', 'pro', …). */
  tier: string;
}

export interface EngineDeps {
  /** The engine's base URL and the person, for a verified user id. */
  resolve(userId: string): Promise<{ base: string; who: EngineWho }>;
  secret(): string | null;
  fetchImpl?: typeof fetch;
}

/** The engine answered with an error that is an outage (5xx, auth, junk). */
export class EngineError extends Error {
  readonly code = 'ENGINE_ERROR';
  constructor(readonly status: number) {
    super(`chalybobs engine ${status}`);
  }
}

async function refusalFor(res: Response): Promise<Error> {
  let code = '';
  try {
    const j = (await res.json()) as { error?: unknown };
    code = typeof j.error === 'string' ? j.error : '';
  } catch {}
  if (res.status === 400) return new EnVivoRefusal('BAD_REQUEST', code || 'bad_request');
  if (res.status === 403 && code === 'full_access_required')
    return new EnVivoRefusal('NEEDS_PLAN', code);
  if (res.status === 404 && code !== 'no_stream')
    return new EnVivoRefusal('NOT_FOUND', code || 'not_found');
  if (res.status === 409) return new EnVivoRefusal('BAD_REQUEST', code || 'not_configured');
  // A platform whose app credentials this deploy lacks: the person's state.
  if (res.status === 503 && /^(kick|twitch|youtube)_not_configured$/.test(code))
    return new EnVivoRefusal('BAD_REQUEST', 'platform_not_configured');
  if (res.status === 502 && code === 'exchange_failed')
    return new EnVivoRefusal('BAD_REQUEST', 'exchange_failed');
  return new EngineError(res.status);
}

const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '');

function toStatus(v: unknown): DestinationStatus | null {
  if (!v || typeof v !== 'object') return null;
  const s = v as { kind?: unknown; platformName?: unknown };
  if (s.kind === 'ok' || s.kind === 'offline' || s.kind === 'expired') return { kind: s.kind };
  if (s.kind === 'pending_approval')
    return { kind: 'pending_approval', platformName: str(s.platformName, 80) };
  return null;
}

/** The engine's /state, re-shaped: unknown fields dropped, anything
 *  key-like never copied (a key can't reach the page by accident). */
export function parseState(raw: unknown): LiveState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const title = str(r.title, 200) || 'Mi transmisión en vivo';
  const oa = (
    r.oauthAvailable && typeof r.oauthAvailable === 'object' ? r.oauthAvailable : {}
  ) as Record<string, unknown>;
  const oauthAvailable: LiveState['oauthAvailable'] = {};
  for (const p of OAUTH_PLATFORMS) oauthAvailable[p] = oa[p] === true;
  const destinations: LiveDestination[] = (Array.isArray(r.destinations) ? r.destinations : [])
    .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object')
    .filter((d) => typeof d.id === 'string' && isPlatformId(d.platformId))
    .map((d) => ({
      id: d.id as string,
      platformId: d.platformId as LiveDestination['platformId'],
      channelHandle: str(d.channelHandle, 200),
      streamTitle: str(d.streamTitle, 200),
      ingestUrl: str(d.ingestUrl, 500),
      hasStreamKey: d.hasStreamKey === true,
      oauthConnected: d.oauthConnected === true,
      enabled: d.enabled === true,
      status: toStatus(d.status),
    }));
  return {
    title,
    isLive: r.isLive === true,
    clipsEnabled: r.clipsEnabled === true,
    isFullAccess: r.isFullAccess === true,
    broadcastMeta: normalizeBroadcastMeta(r.broadcastMeta, title),
    rtmpUrl: str(r.rtmpUrl, 500),
    previewEnabled: r.previewEnabled === true,
    oauthAvailable,
    destinations,
  };
}

export function parseStreams(raw: unknown): PastStream[] {
  const list =
    (raw && typeof raw === 'object' ? (raw as { streams?: unknown }).streams : null) ?? [];
  if (!Array.isArray(list)) return [];
  return list
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
    .filter((s) => typeof s.id === 'string' && typeof s.startedAt === 'string')
    .map((s) => ({
      id: s.id as string,
      startedAt: s.startedAt as string,
      endedAt: typeof s.endedAt === 'string' ? s.endedAt : null,
      durationSec:
        typeof s.durationS === 'number' && Number.isFinite(s.durationS) ? s.durationS : null,
    }));
}

const enc = encodeURIComponent;

export function createEngineEnVivoCore(deps: EngineDeps): EnVivoAdapter {
  const doFetch = deps.fetchImpl ?? fetch;

  async function call<T = unknown>(
    userId: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body: unknown,
    signal: AbortSignal | undefined,
  ): Promise<T> {
    const secret = deps.secret();
    if (!secret) throw new EngineError(503);
    const { base, who } = await deps.resolve(userId);
    const token = mintEngineToken(who, API_AUD, secret);
    let res: Response;
    try {
      res = await doFetch(`${base.replace(/\/+$/, '')}/api/hub/v1${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        cache: 'no-store',
        redirect: 'error',
        signal,
      });
    } catch (e) {
      if (signal?.aborted) throw e;
      throw new EngineError(0);
    }
    if (!res.ok) throw await refusalFor(res);
    try {
      return (await res.json()) as T;
    } catch {
      throw new EngineError(res.status);
    }
  }

  const keyOf = (j: unknown) => {
    const k = j && typeof j === 'object' ? (j as { streamKey?: unknown }).streamKey : null;
    if (typeof k !== 'string') throw new EngineError(502);
    return k;
  };

  return {
    capabilities: () => ({ supportsConnect: true, likenessOptions: [] }),
    state: async (u, signal) => parseState(await call(u, 'GET', '/state', undefined, signal)),
    setTitle: async (u, title, signal) => {
      await call(u, 'PATCH', '/session', { title: title.slice(0, 200) }, signal);
    },
    setClipsEnabled: async (u, on, signal) => {
      await call(u, 'PATCH', '/session', { clipsEnabled: on }, signal);
    },
    streamKey: async (u, signal) => keyOf(await call(u, 'GET', '/stream-key', undefined, signal)),
    regenerateKey: async (u, signal) => {
      await call(u, 'POST', '/stream-key/regenerate', {}, signal);
    },
    addDestination: async (u, platformId, signal) => {
      await call(u, 'POST', '/destinations', { platformId }, signal);
    },
    updateDestination: async (u, id, patch: DestinationPatch, signal) => {
      await call(u, 'PATCH', `/destinations/${enc(id)}`, patch, signal);
    },
    toggleDestination: async (u, id, signal) => {
      const j = await call<{ enabled?: unknown }>(
        u,
        'POST',
        `/destinations/${enc(id)}/toggle`,
        {},
        signal,
      );
      return j.enabled === true;
    },
    removeDestination: async (u, id, signal) => {
      await call(u, 'DELETE', `/destinations/${enc(id)}`, undefined, signal);
    },
    destinationKey: async (u, id, signal) =>
      keyOf(await call(u, 'GET', `/destinations/${enc(id)}/stream-key`, undefined, signal)),
    publishBroadcast: async (u, meta: BroadcastMeta, signal) => {
      await call(u, 'POST', '/broadcast', { meta }, signal);
    },
    streams: async (u, signal) => parseStreams(await call(u, 'GET', '/streams', undefined, signal)),
    oauthAuthorizeUrl: async (u, platform: OAuthPlatform, input, signal) => {
      const j = await call<{ url?: unknown }>(
        u,
        'POST',
        `/oauth/${platform}/authorize`,
        input,
        signal,
      );
      // Only ever send the person to the platform's own https consent page.
      if (typeof j.url !== 'string' || !/^https:\/\//.test(j.url)) throw new EngineError(502);
      return j.url;
    },
    oauthComplete: async (u, platform: OAuthPlatform, input, signal) => {
      await call(u, 'POST', `/oauth/${platform}/complete`, input, signal);
    },
    previewToken: async (u) => {
      const secret = deps.secret();
      if (!secret) return null;
      const { who } = await deps.resolve(u);
      return mintEngineToken(who, PREVIEW_AUD, secret);
    },
  };
}
