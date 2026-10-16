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

export async function publishApi<T>(
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown; query?: Record<string, string> } = {},
): Promise<PublishResult<T>> {
  const method = init.method ?? (init.body === undefined ? 'GET' : 'POST');
  const qs = init.query ? `?${new URLSearchParams(init.query).toString()}` : '';
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}${qs}`, {
      method,
      headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
      body: method === 'POST' ? JSON.stringify(init.body ?? {}) : undefined,
      cache: 'no-store',
    });
  } catch {
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
