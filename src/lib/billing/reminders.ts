// Notices before every charge and the bounce hold (rebuild P2-6, BUILD-SPEC
// §11.3, aceptacion-ux §4). Pure: the cron job feeds it a subscription and
// the clock, and acts on what comes back.
//
//   trial         the charge notice, due the moment the 7-day trial starts
//                 (7 days before the first charge; Law's ≥5 days)
//   trial day 6   optional, TRIAL_DAY6_REMINDER (O-11), the day before
//   monthly       7 days before EVERY renewal
//   annual        30 and 7 days before every renewal
//   summary       once a year for monthly plans (Email 6)
//
// Each notice carries a period key; the email_dispatches unique index on
// (user_id, kind, period_key) is what makes two cron runs send once.

import { MIN_NOTICE_DAYS, PRICING, type PlanKey } from '@/config/pricing';

const DAY = 24 * 60 * 60 * 1000;

/** The mandatory notice must be recorded DELIVERED by this long before the
 *  charge (Términos de Suscripción §2.7 bis): charge − 5 days, i.e. day 2 of
 *  a 7-day trial. The daily cron checks from then on. */
export const NOTICE_DEADLINE_MS = MIN_NOTICE_DAYS * DAY;

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
  /** TRIAL_DAY6_REMINDER. */
  day6Enabled: boolean;
  /** Our id for the subscription (the MP preapproval id). A trial switched
   *  between Pro mensual and Pro anual keeps its charge date but is a new
   *  subscription with a new amount, so it needs its own notice. */
  subKey?: string;
  /** The trial notice date the user was shown at signup (reminder_due_at).
   *  Wins over today's rule, so a trial keeps the date it consented to. */
  trialReminderDueAt?: string | null;
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
      periodKey: trialNoticeKey(sub.nextChargeAt, sub.subKey),
      dueAt: sub.trialReminderDueAt
        ? new Date(sub.trialReminderDueAt)
        : at(p.trial.reminderDaysBefore),
      mandatory: true,
    });
    if (sub.day6Enabled)
      out.push({
        kind: 'trial_1d',
        periodKey: `trial1:${key}${sub.subKey ? `:${sub.subKey}` : ''}`,
        dueAt: at(1),
        mandatory: false,
      });
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

/** The email a notice goes out as: Pro Lealtad's renewal notice is its own
 *  email, with that month's step and amount (Términos 4 bis.6). */
export function noticeEmailKind(
  kind: NoticeKind,
  planKey: PlanKey | null,
): NoticeKind | 'lealtad_7d' {
  return planKey === 'pro_lealtad' && kind === 'renew_7d' ? 'lealtad_7d' : kind;
}

/** The notices whose delivery gates the charge (dueNotices' `mandatory`),
 *  by the email kind they are sent as. The Resend webhook records their
 *  delivery; one list, so a new notice email can't be left out of the
 *  bounce rule. */
const MANDATORY_KINDS: readonly NoticeKind[] = ['trial_7d', 'renew_7d'];
export const MANDATORY_NOTICE_EMAIL_KINDS: ReadonlySet<string> = new Set(
  MANDATORY_KINDS.flatMap((k) => [noticeEmailKind(k, null), noticeEmailKind(k, 'pro_lealtad')]),
);

/** The dedupe key of a trial's charge notice: the day-0 send at trial start
 *  and the cron use the same one, so it goes out once. */
export function trialNoticeKey(chargeAt: string | Date, subKey?: string): string {
  const day = new Date(chargeAt).toISOString().slice(0, 10);
  return `trial:${day}${subKey ? `:${subKey}` : ''}`;
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
 * isn't confirmed delivered by the deadline (charge − 5 days), hold it until
 * 5 days after it is (or after now, while it still isn't).
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
  if (now < charge - NOTICE_DEADLINE_MS) return { action: 'none' };

  const delivered = input.noticeDeliveredAt ? Date.parse(input.noticeDeliveredAt) : NaN;
  if (!Number.isNaN(delivered) && charge >= delivered + 5 * DAY) return { action: 'none' };
  const from = Number.isNaN(delivered) ? now : delivered;
  return { action: 'hold', until: new Date(from + 5 * DAY) };
}
