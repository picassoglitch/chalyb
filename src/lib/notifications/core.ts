// Avisos (SCR-26, P3-16) grouping and deletion rules. Pure.

export interface UserNotice {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  keep_until: string | null;
  read_at: string | null;
  created_at: string;
}

export type NoticeGroup = 'today' | 'week' | 'earlier';

const dayKey = (ms: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date(ms));

/** Today / this week (last 7 days) / earlier, in Mexico City time. */
export function groupNotices(items: UserNotice[], now: number): { group: NoticeGroup; items: UserNotice[] }[] {
  const today = dayKey(now);
  const weekAgo = now - 7 * 86_400_000;
  const out: Record<NoticeGroup, UserNotice[]> = { today: [], week: [], earlier: [] };
  for (const n of items) {
    const at = Date.parse(n.created_at);
    out[dayKey(at) === today ? 'today' : at >= weekAgo ? 'week' : 'earlier'].push(n);
  }
  return (['today', 'week', 'earlier'] as const).filter((g) => out[g].length).map((g) => ({ group: g, items: out[g] }));
}

/** A billing notice stays until its charge date (same rule as the RLS policy). */
export function canDeleteNotice(n: Pick<UserNotice, 'keep_until'>, now: number): boolean {
  return !n.keep_until || Date.parse(n.keep_until) <= now;
}

/** The Avisos copy of a billing reminder (P2 notice → P3-16 in-app notice).
 *  Only the 7-day ones show in Avisos; they stay until the charge date. */
export function inAppBillingNotice(
  kind: string,
  input: { nextChargeAt: string | null; fechaCobro: string; monto: string; periodKey: string },
): {
  kind: 'trial7' | 'renew';
  vars: { fecha_cobro: string; monto: string };
  href: string;
  dedupeKey: string;
  keepUntil: string;
} | null {
  const inApp = kind === 'trial_7d' ? 'trial7' : kind === 'renew_7d' ? 'renew' : null;
  if (!inApp || !input.nextChargeAt) return null;
  return {
    kind: inApp,
    vars: { fecha_cobro: input.fechaCobro, monto: input.monto },
    href: '/app/billing',
    dedupeKey: input.periodKey,
    keepUntil: input.nextChargeAt,
  };
}
