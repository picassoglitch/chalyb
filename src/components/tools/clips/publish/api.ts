'use client';

// The Publish Center's one way to reach the engine: the BFF at
// /api/tools/chalybclip/publish/** (src/lib/tools/adapters/clips/publish-route.ts).

import { useTranslations } from 'next-intl';

export interface PublishApiError {
  status: number;
  reason: string;
  code: string | null;
  refusal: string | null;
  /** The engine's own words for a refusal (4xx): what to fix. */
  message: string | null;
  supportCode: string | null;
}

export type PublishResult<T> = { ok: true; data: T } | { ok: false; error: PublishApiError };

const BASE = '/api/tools/chalybclip/publish/';

// The last good answer of each list read (publishRead), for this page view
// only: switching back to a Publicar tab shows its list at once while it is
// re-read. Any write (POST) empties it, so nothing shown predates a change
// made here: a read that was already in flight when a write started doesn't
// store its answer (`writes` moved on).
const lastRead = new Map<string, unknown>();
let writes = 0;

export async function publishApi<T>(
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown; query?: Record<string, string> } = {},
): Promise<PublishResult<T>> {
  const method = init.method ?? (init.body === undefined ? 'GET' : 'POST');
  const qs = init.query ? `?${new URLSearchParams(init.query).toString()}` : '';
  const write = method !== 'GET';
  // A write empties the cache when it starts and again when it ends (however
  // it ends), so a read that overlapped it never keeps a pre-write answer.
  const settleWrite = () => {
    writes += 1;
    lastRead.clear();
  };
  if (write) settleWrite();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}${qs}`, {
      method,
      headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
      body: method === 'POST' ? JSON.stringify(init.body ?? {}) : undefined,
      cache: 'no-store',
    });
  } catch {
    if (write) settleWrite();
    return {
      ok: false,
      error: {
        status: 0,
        reason: 'network',
        code: null,
        refusal: null,
        message: null,
        supportCode: null,
      },
    };
  }
  if (write) settleWrite();
  const json = (await res.json().catch(() => null)) as {
    ok?: boolean;
    data?: T;
    code?: string;
    error?: Record<string, unknown>;
  } | null;
  if (res.ok && json?.ok) return { ok: true, data: json.data as T };
  const e = json?.error ?? {};
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
  return {
    ok: false,
    error: {
      status: res.status,
      reason: str(e.reason) ?? (res.status === 401 ? 'session' : (json?.code ?? 'unknown')),
      code: str(e.code),
      refusal: str(e.refusal),
      message: str(e.message),
      supportCode: str(e.supportCode),
    },
  };
}

/** A list read for a tab: `onResult` gets the last good answer right away
 *  (when there is one), then the fresh one. The promise settles with the
 *  fresh one. */
export function publishRead<T>(
  path: string,
  onResult: (r: PublishResult<T>) => void,
  init: { query?: Record<string, string> } = {},
): Promise<void> {
  const key = `${path}?${new URLSearchParams(init.query ?? {}).toString()}`;
  if (lastRead.has(key)) onResult({ ok: true, data: lastRead.get(key) as T });
  const startedAt = writes;
  return publishApi<T>(path, init).then((r) => {
    if (r.ok && startedAt === writes) lastRead.set(key, r.data);
    else lastRead.delete(key);
    onResult(r);
  });
}

/** What to tell the person about a failed call. */
export function usePublishErrorText(): (e: PublishApiError) => string {
  const t = useTranslations('clipsPublish.errors');
  return (e) => {
    if (e.refusal === 'terms_pending') return t('terms');
    if (e.status === 401 || e.reason === 'session' || e.reason === 'SESSION_EXPIRED')
      return t('session');
    if (e.reason === 'needs_plan' && !e.message) return t('plan');
    if (e.message && e.status >= 400 && e.status < 500) return e.message;
    if (e.reason === 'network') return t('network');
    if (e.reason === 'timeout') return t('timeout');
    const base = t('generic');
    return e.supportCode ? `${base} ${t('code', { codigo: e.supportCode })}` : base;
  };
}
