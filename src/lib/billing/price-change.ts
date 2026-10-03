// Price increases for existing subscribers (all-pending WS-6; Términos de
// Suscripción §5; aceptacion-ux §4.1; PRICING-CARDS-SPEC §16.8; mockup 89).
// Pure: the cron and the pages feed it a subscription and the clock.
//
// - Who: a subscription renewing at a grandfathered amount below today's
//   price for its plan (GRANDFATHERED_CENTS: the old Pro and VIP amounts).
//   The % is per subscriber, floored (+33% for Pro's old $749).
// - When: EXACTLY 30 calendar days before the first renewal that is at least
//   30 days away, computed in the subscriber's zone (not 29: Quebec; not 31:
//   CA / NY), robust at month ends and DST. A reminder 7 days before if there
//   is no answer.
// - Without express acceptance nothing is ever charged at the new price.
//   What happens instead is PRICE_INCREASE_NO_ANSWER (owner O-2): 'gratis'
//   (default; Términos §5.3, mockup 89) — the plan doesn't renew, the user
//   keeps it until the period ends, then Gratis — or 'keep_old'.

import { isGrandfatheredAmount, planPrice, type PlanKey } from '@/config/pricing';

export const NOTICE_DAYS = 30;
export const REMINDER_DAYS = 7;
export const DEFAULT_TZ = 'America/Mexico_City';

export type NoAnswer = 'gratis' | 'keep_old';

export interface Increase {
  planKey: PlanKey;
  oldCents: number;
  newCents: number;
  /** floor((new − old) × 100 / old): +33 for $749 → $997. */
  pct: number;
}

/** The increase this subscription faces, or null (not grandfathered, or
 *  already at today's price, or a price drop: §5.4 applies those itself). */
export function increaseFor(
  planKey: PlanKey,
  chargedCents: number | null | undefined,
): Increase | null {
  if (!chargedCents || !isGrandfatheredAmount(chargedCents)) return null;
  const newCents = planPrice(planKey).totalCents;
  if (newCents <= chargedCents) return null;
  return {
    planKey,
    oldCents: chargedCents,
    newCents,
    pct: Math.floor(((newCents - chargedCents) * 100) / chargedCents),
  };
}

/** Wall-clock parts of an instant in a zone. */
function partsIn(date: Date, tz: string) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    h: Number(p.hour),
    mi: Number(p.minute),
    s: Number(p.second),
  };
}

/** The instant whose wall clock in `tz` reads y-m-d h:mi:s. */
function fromWallClock(
  y: number,
  m: number,
  d: number,
  h: number,
  mi: number,
  s: number,
  tz: string,
): Date {
  // Start from the naive UTC guess and correct by the zone's offset; twice
  // covers a DST change between the guess and the answer.
  let t = Date.UTC(y, m - 1, d, h, mi, s);
  for (let i = 0; i < 2; i++) {
    const w = partsIn(new Date(t), tz);
    const asUtc = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
    t += Date.UTC(y, m - 1, d, h, mi, s) - asUtc;
  }
  return new Date(t);
}

/** Same wall-clock time, `days` calendar days earlier, in `tz`. */
export function calendarDaysBefore(date: Date, days: number, tz = DEFAULT_TZ): Date {
  const w = partsIn(date, tz);
  const local = new Date(Date.UTC(w.y, w.m - 1, w.d));
  local.setUTCDate(local.getUTCDate() - days);
  return fromWallClock(
    local.getUTCFullYear(),
    local.getUTCMonth() + 1,
    local.getUTCDate(),
    w.h,
    w.mi,
    w.s,
    tz,
  );
}

/** Whole calendar days from a to b in `tz` (a ≤ b). */
export function calendarDaysBetween(a: Date, b: Date, tz = DEFAULT_TZ): number {
  const pa = partsIn(a, tz);
  const pb = partsIn(b, tz);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000);
}

function addPeriod(date: Date, interval: 'month' | 'year'): Date {
  const d = new Date(date);
  if (interval === 'year') d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

/**
 * The renewal the new price applies to: the first one at least 30 calendar
 * days after `from` (when the switch was turned on, or now), in `tz`.
 */
export function targetRenewal(
  nextChargeAt: Date,
  interval: 'month' | 'year',
  from: Date,
  tz = DEFAULT_TZ,
): Date {
  let r = nextChargeAt;
  while (r.getTime() <= from.getTime() || calendarDaysBetween(from, r, tz) < NOTICE_DAYS) {
    r = addPeriod(r, interval);
  }
  return r;
}

export interface Schedule {
  renewalAt: Date;
  noticeAt: Date;
  reminderAt: Date;
  /** The last daily cron run before the renewal: an unanswered notice is
   *  settled here so Mercado Pago never charges first. */
  settleAt: Date;
}

export function schedule(renewalAt: Date, tz = DEFAULT_TZ): Schedule {
  return {
    renewalAt,
    noticeAt: calendarDaysBefore(renewalAt, NOTICE_DAYS, tz),
    reminderAt: calendarDaysBefore(renewalAt, REMINDER_DAYS, tz),
    settleAt: new Date(renewalAt.getTime() - 86_400_000),
  };
}

export type Answer = 'accepted' | 'declined' | null;

export type Step =
  | { kind: 'none' }
  | { kind: 'notice' }
  | { kind: 'reminder' }
  /** Accepted: the renewal may charge the new amount (needs the MP PUT). */
  | { kind: 'apply_new' }
  /** No acceptance with option (a): stop the renewal; Gratis at period end. */
  | { kind: 'end_at_period' }
  /** No acceptance with option (b): keep renewing at the old amount. */
  | { kind: 'keep_old' };

/** What is due now for one subscriber. Each step is idempotent at the
 *  caller (dedupe keys), so the daily cron can repeat it. */
export function nextStep(input: {
  now: Date;
  schedule: Schedule;
  noticeSent: boolean;
  reminderSent: boolean;
  answer: Answer;
  noAnswer: NoAnswer;
}): Step {
  const { now, schedule: s } = input;
  const t = now.getTime();
  if (t < s.noticeAt.getTime()) return { kind: 'none' };
  if (input.answer === 'accepted') return { kind: 'apply_new' };
  if (input.answer === 'declined' || t >= s.settleAt.getTime()) {
    return input.noAnswer === 'keep_old' ? { kind: 'keep_old' } : { kind: 'end_at_period' };
  }
  if (!input.noticeSent) return { kind: 'notice' };
  if (t >= s.reminderAt.getTime() && !input.reminderSent) return { kind: 'reminder' };
  return { kind: 'none' };
}

/** A renewal may charge the new amount only with an acceptance on record. */
export function newAmountAllowed(answer: Answer): boolean {
  return answer === 'accepted';
}
