// Copyright notice-and-takedown (art. 114 Octies LFDA; Uso aceptable §5;
// old P6-8), the pure part.
//
// - A notice needs the four minimum fields of §5.1; the optional ones never
//   condition the removal.
// - A removal stores the content's fingerprint so the same content can't be
//   uploaded again (§5.2.3). The hub only receives links, so the fingerprint
//   is the normalized source URL (same video, however the link is written).
// - A counter-notice restores the content unless the claimant shows a
//   proceeding within 15 business days (§5.3).
// - Repeat infringers (§5.4): accounts with REPEAT_INFRINGER_STRIKES removals
//   upheld (no successful counter-notice) within REPEAT_INFRINGER_WINDOW_DAYS
//   are flagged for an admin to close. TODO(owner/Law): the policy is still
//   "[POLÍTICA DE REINCIDENCIA, p. ej., al tercer retiro procedente en 12
//   meses, sin contra-aviso exitoso]"; the defaults follow that example.

import { createHash } from 'node:crypto';
import { TAKEDOWN_LIMITS } from './takedown-limits';

export interface TakedownInput {
  claimantName: string;
  claimantContact: string;
  contentIdentification: string;
  rightStatement: string;
  contentLocation: string;
  workDescription?: string;
  ownershipEvidence?: string;
  declaredTruthful?: boolean;
}

export type TakedownField =
  | 'claimantName'
  | 'claimantContact'
  | 'contentIdentification'
  | 'rightStatement'
  | 'contentLocation';

/** The minimum fields still missing, in form order (§5.1: 1–4). */
export function takedownMissing(i: TakedownInput): TakedownField[] {
  const req: TakedownField[] = [
    'claimantName',
    'claimantContact',
    'contentIdentification',
    'rightStatement',
    'contentLocation',
  ];
  return req.filter((k) => !(i[k] ?? '').trim());
}

// In their own module so the client form can read them without pulling
// node:crypto into the browser bundle.
export { TAKEDOWN_LIMITS };

export function takedownTooLong(i: TakedownInput): boolean {
  return (Object.keys(TAKEDOWN_LIMITS) as (keyof TakedownInput)[]).some((k) => {
    const v = i[k];
    return typeof v === 'string' && v.length > TAKEDOWN_LIMITS[k];
  });
}

/** Hosts whose links are the same video on YouTube. */
function isYouTube(host: string): boolean {
  return /(^|\.)youtube\.com$|(^|\.)youtube-nocookie\.com$/.test(host);
}

/** A link's id, trimmed and decoded ("abc%20" → "abc"); only the id's own
 *  characters are kept. */
function cleanId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw;
  try {
    s = decodeURIComponent(raw);
  } catch {
    /* keep it as written */
  }
  return /^[A-Za-z0-9_-]+/.exec(s.trim())?.[0] ?? null;
}

/** The parameters that identify the content on each platform; every other
 *  one (ref, mibextid, filter, si, utm_*, …) is dropped. Hosts not listed
 *  keep their parameters minus the known tracking ones. */
const KEEP_PARAMS: Record<string, readonly string[]> = {
  'kick.com': ['clip'],
  'facebook.com': ['v', 'story_fbid', 'fbid', 'id'],
  'fb.watch': [],
  'twitch.tv': [],
  'clips.twitch.tv': [],
};
const TRACKING = /^(utm_|si$|t$|feature$|fbclid$|gclid$|ref$|ref_src$|mibextid$|igshid$|share_)/;

/** Paths these platforms read case-insensitively (channels, /videos/); a
 *  Twitch clip slug and everything else keep their case. */
function pathFor(host: string, path: string): string {
  const trimmed = path.replace(/\/+$/, '');
  if (host === 'kick.com') return trimmed.toLowerCase();
  if (host === 'twitch.tv') {
    const seg = trimmed.split('/');
    return seg
      .map((x, i) => (seg[i - 1]?.toLowerCase() === 'clip' ? x : x.toLowerCase()))
      .join('/');
  }
  return trimmed;
}

/**
 * One fingerprint per piece of content, however its link is written (§5.2.3;
 * the upload side, checkSourceUrl, accepts the same hosts): lowercase host
 * without "www."/"m.", every YouTube host and form (watch, youtu.be, embed,
 * v, e, shorts, live, nocookie, music) to the video id, only the identifying
 * parameters, no fragment. Not a URL → null.
 */
export function normalizeContentUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.toLowerCase().replace(/^(www|m|mobile)\./, '');

  if (host === 'youtu.be' || isYouTube(host)) {
    const id =
      host === 'youtu.be'
        ? cleanId(u.pathname.split('/')[1])
        : (cleanId(/^\/(?:embed|v|e|shorts|live)\/([^/]+)/i.exec(u.pathname)?.[1]) ??
          cleanId(u.searchParams.get('v')));
    if (id) return `youtube.com/watch?v=${id}`;
  }

  const allow = KEEP_PARAMS[host];
  const keep = [...u.searchParams.entries()]
    .filter(([k]) => (allow ? allow.includes(k) : !TRACKING.test(k)))
    .map(([k, v]) => [k, v.trim()] as [string, string])
    .sort(([a], [b]) => a.localeCompare(b));
  const q = keep.length ? `?${new URLSearchParams(keep).toString()}` : '';
  return `${host}${pathFor(host, u.pathname)}${q}`;
}

export function contentFingerprint(raw: string): string | null {
  const n = normalizeContentUrl(raw);
  return n ? createHash('sha256').update(n).digest('hex') : null;
}

export const REPEAT_INFRINGER_STRIKES = 3;
export const REPEAT_INFRINGER_WINDOW_DAYS = 365;
export const COUNTER_NOTICE_BUSINESS_DAYS = 15;

/** Strikes = removals in the window that weren't reversed by a counter-notice. */
export function strikeCount(
  notices: { status: string; removed_at: string | null }[],
  now: Date,
  windowDays = REPEAT_INFRINGER_WINDOW_DAYS,
): number {
  const since = now.getTime() - windowDays * 86_400_000;
  return notices.filter(
    (n) =>
      n.removed_at &&
      Date.parse(n.removed_at) >= since &&
      ['removed', 'upheld', 'counter_noticed'].includes(n.status),
  ).length;
}

export function isRepeatInfringer(strikes: number, threshold = REPEAT_INFRINGER_STRIKES): boolean {
  return strikes >= threshold;
}

/** What happens to a counter-noticed takedown once its deadline passes. */
export function counterNoticeOutcome(
  n: {
    status: string;
    claimant_deadline: string | null;
    claimant_proceeding_at: string | null;
  },
  now: Date,
): 'restore' | 'upheld' | 'wait' | null {
  if (n.status !== 'counter_noticed' || !n.claimant_deadline) return null;
  if (n.claimant_proceeding_at) return 'upheld';
  return now.getTime() > Date.parse(n.claimant_deadline) ? 'restore' : 'wait';
}
