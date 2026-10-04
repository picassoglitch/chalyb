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

export const TAKEDOWN_LIMITS: Record<keyof TakedownInput, number> = {
  claimantName: 300,
  claimantContact: 500,
  contentIdentification: 4000,
  rightStatement: 4000,
  contentLocation: 2000,
  workDescription: 4000,
  ownershipEvidence: 4000,
  declaredTruthful: 0,
};

export function takedownTooLong(i: TakedownInput): boolean {
  return (Object.keys(TAKEDOWN_LIMITS) as (keyof TakedownInput)[]).some((k) => {
    const v = i[k];
    return typeof v === 'string' && v.length > TAKEDOWN_LIMITS[k];
  });
}

/**
 * One fingerprint per piece of content, however its link is written:
 * lowercase host without "www."/"m.", YouTube short/long/shorts forms to the
 * video id, tracking parameters and fragments dropped. Not a URL → null.
 */
export function normalizeContentUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, '');
  if (host === 'youtu.be') return `youtube.com/watch?v=${u.pathname.slice(1).split('/')[0]}`;
  if (host === 'youtube.com') {
    const shorts = /^\/(shorts|live)\/([^/]+)/.exec(u.pathname);
    const v = shorts?.[2] ?? u.searchParams.get('v');
    if (v) return `youtube.com/watch?v=${v}`;
  }
  const keep = [...u.searchParams.entries()]
    .filter(([k]) => !/^(utm_|si$|t$|feature$|fbclid$|gclid$)/.test(k))
    .sort(([a], [b]) => a.localeCompare(b));
  const q = keep.length ? `?${new URLSearchParams(keep).toString()}` : '';
  return `${host}${u.pathname.replace(/\/+$/, '')}${q}`;
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
