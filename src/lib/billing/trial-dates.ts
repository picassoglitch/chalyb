// The dates a trial promises (aceptacion-ux §3.2). Pure; UTC instants.
//
// The free month is PRICING.trial.days long; the first charge happens when it
// ends; the notice goes out PRICING.trial.reminderDaysBefore days before.

import { PRICING } from '@/config/pricing';

const DAY = 24 * 60 * 60 * 1000;

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
    reminderAt: new Date(trialEndsAt.getTime() - p.trial.reminderDaysBefore * DAY),
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
