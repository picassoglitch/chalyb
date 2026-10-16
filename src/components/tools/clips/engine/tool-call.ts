// Browser side of the Clips engine BFF routes (/api/tools/chalybclip/**).
// Every answer is { ok: true, data } or { ok: false, error | code }; this
// turns it into data or a ToolCallError the screen words with ErrorCopy.

export interface ErrorCopy {
  generic: string;
  /** "{codigo}" is replaced with the support code. */
  code: string;
  session: string;
  no_credits: string;
  rate_limited: string;
  too_large: string;
  needs_plan: string;
  not_found: string;
  bad_request: string;
  forbidden: string;
  timeout: string;
}

export class ToolCallError extends Error {
  constructor(
    readonly reason: string,
    readonly supportCode: string | null,
    readonly refusal: string | null,
  ) {
    super(reason);
  }
}

export async function toolCall<T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST',
  body?: unknown,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/tools/chalybclip${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    throw new ToolCallError('network', null, null);
  }
  const json = (await res.json().catch(() => null)) as {
    ok?: boolean;
    data?: T;
    code?: string;
    error?: { reason?: string; supportCode?: string; refusal?: string };
  } | null;
  if (json?.ok) return json.data as T;
  if (json?.code === 'SESSION_EXPIRED') throw new ToolCallError('session', null, null);
  throw new ToolCallError(
    json?.error?.reason ?? 'unknown',
    json?.error?.supportCode ?? null,
    json?.error?.refusal ?? null,
  );
}

/** One sentence for a failed call. */
export function errorText(err: unknown, copy: ErrorCopy): string {
  if (!(err instanceof ToolCallError)) return copy.generic;
  const reason = err.reason as keyof ErrorCopy;
  const base =
    err.reason === 'session'
      ? copy.session
      : reason in copy && reason !== 'code' && reason !== 'generic'
        ? copy[reason]
        : copy.generic;
  return err.supportCode ? `${base} ${copy.code.replace('{codigo}', err.supportCode)}` : base;
}
