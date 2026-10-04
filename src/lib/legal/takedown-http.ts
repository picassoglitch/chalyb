// POST /api/legal/takedown, the testable part (7a MED 6). The endpoint is
// public, so it reads the body with a hard byte cap (a chunked body has no
// content-length to trust), limits notices per IP and per claimant contact,
// and stores a hashed IP and the user agent with the notice as evidence.

import { createHash } from 'node:crypto';
import { takedownMissing, takedownTooLong, type TakedownInput } from './takedown';

export const TAKEDOWN_MAX_BYTES = 64_000;

/** Per IP and per claimant contact; check_contact_rate_limit windows. */
export const TAKEDOWN_RATE = {
  ip: { windowSeconds: 60 * 60, max: 10 },
  contact: { windowSeconds: 24 * 60 * 60, max: 5 },
} as const;

export interface TakedownEvidence {
  /** sha256 of the IP; the IP itself is never stored. */
  ipHash: string | null;
  userAgent: string | null;
}

export type TakedownResult =
  | { ok: true; id: string | null }
  | { ok: false; code: string; fields?: string[] };

export interface TakedownDeps {
  /** true = allowed (and the attempt is counted). */
  rateLimit(key: string, windowSeconds: number, max: number): Promise<boolean>;
  submit(input: TakedownInput, evidence: TakedownEvidence): Promise<TakedownResult>;
}

/** The body as text, or null as soon as it passes `max` bytes. */
export async function readBodyCapped(req: Request, max: number): Promise<string | null> {
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function hashIp(ip: string | null): string | null {
  return ip ? createHash('sha256').update(`takedown-evidence:${ip}`).digest('hex') : null;
}

function clientIp(h: Headers): string | null {
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || null;
}

export async function handleTakedownPost(
  req: Request,
  deps: TakedownDeps,
): Promise<{ status: number; body: TakedownResult }> {
  // A declared size over the cap is refused without reading; a missing or
  // false one is caught by the capped read.
  if (Number(req.headers.get('content-length') ?? 0) > TAKEDOWN_MAX_BYTES)
    return { status: 413, body: { ok: false, code: 'tooLong' } };
  const raw = await readBodyCapped(req, TAKEDOWN_MAX_BYTES);
  if (raw === null) return { status: 413, body: { ok: false, code: 'tooLong' } };
  let b: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') b = parsed as Record<string, unknown>;
  } catch {
    /* an empty notice: the missing fields answer it */
  }
  // Honeypot: people never fill a field they can't see.
  if (typeof b.website === 'string' && b.website.trim())
    return { status: 200, body: { ok: true, id: null } };

  const str = (k: string) => (typeof b[k] === 'string' ? (b[k] as string) : '');
  const input: TakedownInput = {
    claimantName: str('claimantName'),
    claimantContact: str('claimantContact'),
    contentIdentification: str('contentIdentification'),
    rightStatement: str('rightStatement'),
    contentLocation: str('contentLocation'),
    workDescription: str('workDescription'),
    ownershipEvidence: str('ownershipEvidence'),
    declaredTruthful: b.declaredTruthful === true,
  };
  // A form error doesn't use up the claimant's attempts.
  const missing = takedownMissing(input);
  if (missing.length) return { status: 422, body: { ok: false, code: 'missing', fields: missing } };
  if (takedownTooLong(input)) return { status: 422, body: { ok: false, code: 'tooLong' } };

  const ip = clientIp(req.headers);
  const contact = input.claimantContact.trim().toLowerCase();
  const limited =
    !(await deps.rateLimit(
      `takedown:ip:${ip ?? 'unknown'}`,
      TAKEDOWN_RATE.ip.windowSeconds,
      TAKEDOWN_RATE.ip.max,
    )) ||
    !(await deps.rateLimit(
      `takedown:contact:${contact}`,
      TAKEDOWN_RATE.contact.windowSeconds,
      TAKEDOWN_RATE.contact.max,
    ));
  if (limited) return { status: 429, body: { ok: false, code: 'rateLimited' } };

  const result = await deps.submit(input, {
    ipHash: hashIp(ip),
    userAgent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
  });
  return { status: result.ok ? 200 : result.code === 'db' ? 502 : 422, body: result };
}
