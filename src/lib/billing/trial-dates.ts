// The dates a trial promises (aceptacion-ux §3.2). Pure; UTC instants.
//
// The trial is PRICING.trial.days (7) long; the first charge happens when it
// ends; the charge notice goes out PRICING.trial.reminderDaysBefore (7) days
// before, i.e. the moment the trial starts. Start 3 oct 2026 → charge 10 oct.

import { MIN_NOTICE_DAYS, PRICING } from '@/config/pricing';

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

/**
 * T-6 · Switching plans during the trial sends a fresh charge notice right
 * away; a switch late in the trial would leave it under the legal 5 days.
 * Owner, 2026-10-03: push the first charge back — never before the trial's
 * own end, and at least MIN_NOTICE_DAYS (plus the notice slack) after the
 * notice. The trial (and its access) runs to the same instant: the extra
 * days are free, and there is no gap with no grace after a trial.
 */
export function switchChargeDate(trialEndsAt: Date, noticeAt: Date): Date {
  return new Date(
    Math.max(trialEndsAt.getTime(), noticeAt.getTime() + MIN_NOTICE_DAYS * DAY + NOTICE_SLACK_MS),
  );
}

/** Whether a switch at `noticeAt` moves the charge past the trial's end. */
export function switchMovesCharge(trialEndsAt: Date, noticeAt: Date): boolean {
  return switchChargeDate(trialEndsAt, noticeAt).getTime() > trialEndsAt.getTime();
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
    // Owner, 2026-10-03 (Law aceptacion-ux §3.6): the charge notice goes out
    // on day 0, sent by the signup itself, not by a later cron run. With
    // reminderDaysBefore = days that is the start; a shorter lead falls back
    // to the last cron run that still meets it.
    reminderAt:
      p.trial.reminderDaysBefore >= p.trial.days
        ? start
        : noticeRunBefore(trialEndsAt, p.trial.reminderDaysBefore),
  };
}

/** A trial's real length in days: PRICING.trial.days, or more when a late
 *  plan switch pushed the first charge back (switchChargeDate). */
export function trialLengthDays(
  startedAt: string | Date,
  trialEndsAt: string | Date,
  p = PRICING,
): number {
  const ms = new Date(trialEndsAt).getTime() - new Date(startedAt).getTime();
  return Math.max(p.trial.days, Math.round(ms / DAY));
}

/** Whole days left in a trial, rounded up (the banner's "te quedan {n} días"). */
export function trialDaysLeft(trialEndsAt: string | Date, nowMs: number): number {
  const end = typeof trialEndsAt === 'string' ? Date.parse(trialEndsAt) : trialEndsAt.getTime();
  return Math.max(0, Math.ceil((end - nowMs) / DAY));
}

/**
 * Add whole calendar periods to a date (renewals). Términos de Suscripción
 * §3.2: the charge falls on the same day of the month as the period's start,
 * and on the month's last day when that day doesn't exist (31 → 30 abr,
 * 28/29 feb). `anchorDay` is that original day: chaining from a clamped date
 * (28 feb) must come back to 31 mar, not drift to the 28th. Time of day is
 * kept; UTC.
 */
export function addInterval(
  date: Date,
  interval: 'month' | 'year',
  count = 1,
  anchorDay = date.getUTCDate(),
): Date {
  const months = interval === 'year' ? 12 * count : count;
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const d = new Date(date);
  d.setUTCFullYear(y, m, Math.min(anchorDay, lastDay));
  return d;
}
