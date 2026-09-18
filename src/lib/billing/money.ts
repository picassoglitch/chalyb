// The money vocabulary. ONE definition of "hoy", ONE definition of "this
// counts as money we have", ONE exchange rate — imported by every surface
// that shows a peso figure.
//
// WHY THIS FILE EXISTS
// The command center used to answer "¿cuánto entró hoy?" three different
// ways at the same time:
//
//   top bar / AI rail   SUM(payments) where status='approved' and
//                       created_at >= UTC midnight
//   /dashboard/revenue  SUM(engine_health.revenue_cents) — a per-engine
//                       snapshot that has nothing to do with today
//   /dashboard/billing  SUM(payments) this month, server-local month start,
//                       USD converted at 17 and MXN not
//
// So one $10 charge read as $10 in the top bar and $0 on the revenue card,
// on the same screen. Everything below is the fix: pure, testable, and the
// only place these rules are written down.
//
// Pure on purpose — no database, no `server-only`. The queries that use it
// live in money-data.ts (admin client) and the pages that own their own rows
// (/app/billing) call summariseMoney directly on what they already fetched.

/** The business runs on Mexico City time. A payment at 23:30 on the 5th in
 *  Mexico City belongs to the 5th, not to the 6th because UTC says so. */
export const PLATFORM_TIMEZONE = 'America/Mexico_City';

/**
 * Manual USD→MXN rate. NOT a live quote: nothing in this system talks to an
 * FX feed, so every surface that converts must say so next to the number.
 * Use FX_MANUAL_NOTE for that copy — the honesty is part of the contract.
 */
export const MANUAL_USD_MXN_RATE = 17;

/** The disclosure that has to appear wherever MANUAL_USD_MXN_RATE was applied. */
export const FX_MANUAL_NOTE = `FX estimado · tipo de cambio manual ${MANUAL_USD_MXN_RATE} MXN/USD (no es una cotización en vivo)`;

/**
 * Payment statuses that mean the money is ours.
 *
 * `approved` is what our own webhook writes for a settled charge. The other
 * two are Mercado Pago's vocabulary leaking into rows we already stored:
 * `accredited` from the Payments API and `processed` from the authorized
 * payments endpoint (a recurring charge whose `payment.status` was absent,
 * so the authorized-payment status was written instead). Both mean paid.
 *
 * THIS LIST IS FOR READING THE LEDGER ONLY. It never decides whether to
 * grant anything — the webhook's grant gate stays an exact `=== 'approved'`
 * plus the amount/currency check in webhook-verify.ts. Widening what counts
 * as settled here changes what a number on a dashboard says; it cannot
 * change what a payment buys.
 */
export const SETTLED_PAYMENT_STATUSES = ['approved', 'accredited', 'processed'] as const;

export function isSettledPaymentStatus(status: string | null | undefined): boolean {
  return (SETTLED_PAYMENT_STATUSES as readonly string[]).includes(
    (status ?? '').trim().toLowerCase(),
  );
}

// ── Timezone-aware day and month boundaries ─────────────────────────────

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((p) => p.type === type)?.value ?? '0';
    return Number(found);
  };
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    // 'en-US' + hour12:false renders midnight as 24 in some ICU versions.
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  };
}

/** How far `timeZone` is ahead of UTC at this instant, in ms. */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // Drop sub-second precision on both sides so the difference is the offset
  // and nothing else.
  return asIfUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The UTC instant of a local wall-clock time in `timeZone`. Applied twice
 *  because the offset depends on the instant we are solving for — one pass
 *  lands in the right neighbourhood, the second fixes the DST edge. */
function wallClockToUtc(
  wall: { year: number; month: number; day: number },
  timeZone: string,
): Date {
  const naive = Date.UTC(wall.year, wall.month - 1, wall.day, 0, 0, 0);
  let instant = naive - zoneOffsetMs(new Date(naive), timeZone);
  instant = naive - zoneOffsetMs(new Date(instant), timeZone);
  return new Date(instant);
}

/** Midnight that starts the day `at` falls on, in `timeZone`. */
export function zonedStartOfDay(at: Date, timeZone: string = PLATFORM_TIMEZONE): Date {
  const p = zonedParts(at, timeZone);
  return wallClockToUtc({ year: p.year, month: p.month, day: p.day }, timeZone);
}

/** Midnight on the 1st of the month `at` falls in, in `timeZone`. */
export function zonedStartOfMonth(at: Date, timeZone: string = PLATFORM_TIMEZONE): Date {
  const p = zonedParts(at, timeZone);
  return wallClockToUtc({ year: p.year, month: p.month, day: 1 }, timeZone);
}

/** The day label for `at` in `timeZone`, e.g. "2026-09-18". Used so a
 *  surface can state which day the figure is for instead of implying it. */
export function zonedDayKey(at: Date, timeZone: string = PLATFORM_TIMEZONE): string {
  const p = zonedParts(at, timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

// ── Summing a set of payment rows ───────────────────────────────────────

/** The bits of a `payments` row the money math needs. Anything that can
 *  produce this shape (admin query, user-scoped query, a test fixture) can
 *  be summarised the same way. */
export interface MoneyRow {
  amount_cents: number | null;
  currency: string | null;
  status: string | null;
}

export interface CurrencyTotal {
  currency: string;
  amountCents: number;
  count: number;
}

export interface MoneySummary {
  /** Everything settled, converted to MXN minor units. When `usedManualFx`
   *  is true this number is an ESTIMATE and the surface must say so. */
  totalMxnCents: number;
  /** The same money without conversion, one entry per currency seen.
   *  This is the honest figure when only one currency is present. */
  byCurrency: CurrencyTotal[];
  /** How many settled payments went into the total. 0 means "sin datos" —
   *  never render a trend or a delta against it. */
  count: number;
  /** True when at least one non-MXN row was converted at the manual rate. */
  usedManualFx: boolean;
}

export const EMPTY_MONEY: MoneySummary = {
  totalMxnCents: 0,
  byCurrency: [],
  count: 0,
  usedManualFx: false,
};

/** USD (or anything not MXN) minor units → MXN minor units, manual rate. */
export function toMxnCents(amountCents: number, currency: string | null | undefined): number {
  const code = (currency ?? 'MXN').trim().toUpperCase();
  return code === 'MXN' ? amountCents : Math.round(amountCents * MANUAL_USD_MXN_RATE);
}

/** Sum the settled rows. Rows in any other status are ignored entirely —
 *  a pending OXXO ticket is not money, and neither is a refund. */
export function summariseMoney(rows: readonly MoneyRow[]): MoneySummary {
  const byCurrency = new Map<string, CurrencyTotal>();
  let totalMxnCents = 0;
  let count = 0;
  let usedManualFx = false;

  for (const row of rows) {
    if (!isSettledPaymentStatus(row.status)) continue;
    const cents = row.amount_cents ?? 0;
    const currency = (row.currency ?? 'MXN').trim().toUpperCase() || 'MXN';
    const entry = byCurrency.get(currency) ?? { currency, amountCents: 0, count: 0 };
    entry.amountCents += cents;
    entry.count += 1;
    byCurrency.set(currency, entry);
    totalMxnCents += toMxnCents(cents, currency);
    if (currency !== 'MXN' && cents !== 0) usedManualFx = true;
    count += 1;
  }

  return {
    totalMxnCents,
    byCurrency: Array.from(byCurrency.values()).sort((a, b) => b.amountCents - a.amountCents),
    count,
    usedManualFx,
  };
}

// ── Rendering ───────────────────────────────────────────────────────────

/** "$1,234.00" — MXN minor units, Mexican grouping, always two decimals. */
export function formatMxn(amountCents: number): string {
  return `$${(amountCents / 100).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * What to print for a money figure, and what to print under it.
 *
 * The rule the command center kept breaking: a zero with no data behind it
 * is not "$0.00 (+12% vs ayer)", it is "sin datos". A delta needs two
 * populated periods; we do not fake one to make a card look alive.
 */
export function moneyDisplay(summary: MoneySummary): { value: string; hasData: boolean } {
  if (summary.count === 0) return { value: formatMxn(0), hasData: false };
  return { value: formatMxn(summary.totalMxnCents), hasData: true };
}
