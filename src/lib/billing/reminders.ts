// Notices before every charge and the bounce hold (rebuild P2-6, BUILD-SPEC
// §11.3, aceptacion-ux §4). Pure: the cron job feeds it a subscription and
// the clock, and acts on what comes back.
//
//   trial         the last cron run ≥ 5 days before the first charge
//   trial day 29  optional, TRIAL_DAY29_REMINDER_ENABLED (D5)
//   monthly       7 days before EVERY renewal
//   annual        30 and 7 days before every renewal
//   summary       once a year for monthly plans (Email 6)
//
// Each notice carries a period key; the email_dispatches unique index on
// (user_id, kind, period_key) is what makes two cron runs send once.

import { PRICING } from '@/config/pricing';
import { noticeRunBefore } from './trial-dates';

const DAY = 24 * 60 * 60 * 1000;

/** How far ahead of a charge the bounce check looks. The cron runs daily
 *  (Vercel Hobby allows daily jobs only; OPS-7), so two days guarantees at
 *  least one run before every charge. */
export const HOLD_LOOKAHEAD_MS = 2 * DAY;

export type NoticeKind = 'trial_7d' | 'trial_1d' | 'renew_30d' | 'renew_7d' | 'annual_summary';

export interface Notice {
  kind: NoticeKind;
  /** Unique per charge (or per year for the summary). */
  periodKey: string;
  /** When it became due. */
  dueAt: Date;
  /** Whether this notice is the legally required one for that charge: its
   *  delivery gates the charge (bounce rule). */
  mandatory: boolean;
}

export interface NoticeInput {
  state: 'trialing' | 'pro' | string;
  interval: 'month' | 'year';
  /** The next charge, UTC. */
  nextChargeAt: string | null;
  /** When the subscription started (for the yearly summary). */
  startedAt: string | null;
  day29Enabled: boolean;
}

/** Notices due at `now` (already due, not yet necessarily sent). */
export function dueNotices(sub: NoticeInput, now: Date, p = PRICING): Notice[] {
  if (!sub.nextChargeAt) return [];
  const charge = Date.parse(sub.nextChargeAt);
  if (Number.isNaN(charge) || now.getTime() >= charge) return [];
  const key = new Date(charge).toISOString().slice(0, 10);
  const out: Notice[] = [];
  const at = (days: number) => new Date(charge - days * DAY);

  if (sub.state === 'trialing') {
    out.push({
      kind: 'trial_7d',
      periodKey: `trial:${key}`,
      dueAt: noticeRunBefore(new Date(charge), p.trial.reminderDaysBefore),
      mandatory: true,
    });
    if (sub.day29Enabled)
      out.push({ kind: 'trial_1d', periodKey: `trial1:${key}`, dueAt: at(1), mandatory: false });
  } else if (sub.state === 'pro') {
    if (sub.interval === 'year') {
      const [early, late] = p.reminders.yearDaysBefore;
      out.push({
        kind: 'renew_30d',
        periodKey: `renew30:${key}`,
        dueAt: at(early),
        mandatory: false,
      });
      out.push({ kind: 'renew_7d', periodKey: `renew7:${key}`, dueAt: at(late), mandatory: true });
    } else {
      out.push({
        kind: 'renew_7d',
        periodKey: `renew7:${key}`,
        dueAt: at(p.reminders.monthDaysBefore),
        mandatory: true,
      });
    }
  }

  if (sub.state === 'pro' && sub.interval === 'month' && sub.startedAt) {
    // Once a year, on the subscription's anniversary.
    const start = new Date(sub.startedAt);
    const years = now.getUTCFullYear() - start.getUTCFullYear();
    if (years >= 1) {
      const anniversary = new Date(start);
      anniversary.setUTCFullYear(start.getUTCFullYear() + years);
      if (now >= anniversary) {
        out.push({
          kind: 'annual_summary',
          periodKey: `summary:${anniversary.getUTCFullYear()}`,
          dueAt: anniversary,
          mandatory: false,
        });
      }
    }
  }
  return out.filter((n) => now >= n.dueAt);
}

export type HoldDecision =
  | { action: 'none' }
  /** Pause the preapproval: no charge until `until`. */
  | { action: 'hold'; until: Date }
  /** The hold is over: resume charging. */
  | { action: 'resume' };

/**
 * The bounce rule (Términos de Suscripción §2.7 bis): no charge until at
 * least 5 calendar days after an EFFECTIVE notice. If the mandatory notice
 * isn't confirmed delivered by HOLD_LOOKAHEAD_MS before the charge, hold it.
 */
export function holdDecision(input: {
  nextChargeAt: string | null;
  /** When the mandatory notice for this charge was confirmed delivered
   *  (email delivered, or the alternate channel acknowledged). */
  noticeDeliveredAt: string | null;
  holdUntil: string | null;
  now: Date;
}): HoldDecision {
  const now = input.now.getTime();
  if (input.holdUntil) {
    // Already holding. It ends 5 days after an effective notice, and not
    // before the hold date already promised.
    if (!input.noticeDeliveredAt) return { action: 'none' }; // keep holding
    const resumeAt = Math.max(
      Date.parse(input.noticeDeliveredAt) + 5 * DAY,
      Date.parse(input.holdUntil),
    );
    if (now >= resumeAt) return { action: 'resume' };
    return resumeAt === Date.parse(input.holdUntil)
      ? { action: 'none' }
      : { action: 'hold', until: new Date(resumeAt) };
  }
  if (!input.nextChargeAt) return { action: 'none' };
  const charge = Date.parse(input.nextChargeAt);
  if (now < charge - HOLD_LOOKAHEAD_MS) return { action: 'none' };

  const delivered = input.noticeDeliveredAt ? Date.parse(input.noticeDeliveredAt) : NaN;
  if (!Number.isNaN(delivered) && charge >= delivered + 5 * DAY) return { action: 'none' };
  const from = Number.isNaN(delivered) ? now : delivered;
  return { action: 'hold', until: new Date(from + 5 * DAY) };
}
