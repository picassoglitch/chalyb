// The dates a trial promises (aceptacion-ux §3.2). Pure; UTC instants.
//
// The trial is PRICING.trial.days (7) long; the first charge happens when it
// ends; the charge notice goes out at the last daily cron run that is at
// least PRICING.trial.reminderDaysBefore (5) days before it.
// Start 3 oct 2026 18:00 UTC → notice 5 oct 15:00 UTC → charge 10 oct.

import { PRICING } from '@/config/pricing';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

/** The billing cron's daily run, UTC hour (vercel.json "0 15 * * *"). */
export const BILLING_CRON_UTC_HOUR = 15;
/** Room for the cron starting late and the email being delivered, so the
 *  notice still lands a full `days` before the charge. */
const NOTICE_SLACK_MS = HOUR;

/**
 * When the notice for a charge goes out: the last cron run that leaves at
 * least `days` (plus slack) before the charge. A notice due exactly `days`
 * before would only be sent at the NEXT run — hours short of the legal
 * minimum, which the bounce hold would then answer by holding the charge.
 */
export function noticeRunBefore(chargeAt: Date, days: number): Date {
  const latest = chargeAt.getTime() - days * DAY - NOTICE_SLACK_MS;
  const run = new Date(latest);
  run.setUTCHours(BILLING_CRON_UTC_HOUR, 0, 0, 0);
  if (run.getTime() > latest) run.setTime(run.getTime() - DAY);
  return run;
}

export interface TrialDates {
  startsAt: Date;
  trialEndsAt: Date;
  chargeAt: Date;
  reminderAt: Date;
}

export function trialDates(start: Date, p = PRICING): TrialDates {
  const trialEndsAt = new Date(start.getTime() + p.trial.days * DAY);
  return {
    startsAt: start,
    trialEndsAt,
    chargeAt: trialEndsAt,
    reminderAt: noticeRunBefore(trialEndsAt, p.trial.reminderDaysBefore),
  };
}

/** Whole days left in a trial, rounded up (the banner's "te quedan {n} días"). */
export function trialDaysLeft(trialEndsAt: string | Date, nowMs: number): number {
  const end = typeof trialEndsAt === 'string' ? Date.parse(trialEndsAt) : trialEndsAt.getTime();
  return Math.max(0, Math.ceil((end - nowMs) / DAY));
}

/** Add whole calendar periods to a date (renewals). */
export function addInterval(date: Date, interval: 'month' | 'year', count = 1): Date {
  const d = new Date(date);
  if (interval === 'year') d.setUTCFullYear(d.getUTCFullYear() + count);
  else d.setUTCMonth(d.getUTCMonth() + count);
  return d;
}
