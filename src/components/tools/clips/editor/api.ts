'use client';

// Browser → BFF calls for the clip editor (/api/tools/chalybclip/clips/…).
// The BFF answers { ok, data } or { ok:false, error:{reason, supportCode,
// refusal?} }; a failure becomes an EditorCallError the screen turns into
// words.

import type { ToolError } from '@/lib/tools/bff-core';

export const BFF = '/api/tools/chalybclip/clips';

export class EditorCallError extends Error {
  constructor(
    readonly status: number,
    readonly error: ToolError | null,
  ) {
    super(`editor call failed (${status}${error ? ` ${error.reason}` : ''})`);
  }
}

export async function call<T>(
  path: string,
  init: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BFF}/${path}`, {
      method: init.method ?? 'GET',
      headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init.signal,
      cache: 'no-store',
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    throw new EditorCallError(0, null);
  }
  const json = (await res.json().catch(() => null)) as
    | { ok: true; data: T }
    | { ok: false; error?: ToolError }
    | null;
  if (!res.ok || !json || json.ok !== true)
    throw new EditorCallError(res.status, (json && 'error' in json && json.error) || null);
  return json.data;
}

export const clipPath = (id: string, rest: string) => `${encodeURIComponent(id)}/${rest}`;
