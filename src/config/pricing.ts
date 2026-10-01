// The ONE pricing source (rebuild prompt P2 "Config", BUILD-SPEC §6.1).
//
// Every amount a customer sees or pays — plan cards, the trial billing
// block, Mi plan, emails, the Mercado Pago preapproval, the webhook's price
// gate — derives from here. No component, email or legal text writes an
// amount by hand.
//
// IVA (Q1, decided 2026-09-30 by the owner): the list prices below do NOT
// include IVA, so every customer total is list price × (1 + ivaRate).
// `PRICES_INCLUDE_IVA=true` would treat the list prices as totals instead.
//
// Amounts are integer centavos; the IVA math stays exact (×116/100).
//
// Pure: no imports, so client code, emails and tests can all read it.

export const CURRENCY = 'MXN';

/** TODO(accountant): 16% is the general rate; confirm for users abroad (OPS-17). */
export const IVA_RATE_PERCENT = 16;

/** List prices, BEFORE IVA, in centavos. */
const LIST_CENTS = {
  pro: { month: 74_900, year: 749_000 },
  vip: { month: 249_900 },
  packs: { tokens_100k: 14_900, tokens_500k: 59_900, tokens_2m: 199_900 },
} as const;

export type PlanKey = 'pro_month' | 'pro_year' | 'vip_month';
export type PackId = keyof typeof LIST_CENTS.packs;

function readBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw === '1' || raw.toLowerCase() === 'true';
}

/** Q1 · Whether the list prices already include IVA. Owner: they don't. */
export function pricesIncludeIva(): boolean {
  return readBool('PRICES_INCLUDE_IVA', false);
}

/** Customer total for a list price, in centavos. */
export function withIva(listCents: number, includeIva = pricesIncludeIva()): number {
  if (includeIva) return listCents;
  // Exact for every list price above (all multiples of 25 centavos); rounded
  // half-up to the centavo for anything else.
  return Math.round((listCents * (100 + IVA_RATE_PERCENT)) / 100);
}

/** The IVA contained in a total, in centavos (for receipts and movements). */
export function ivaPortion(totalCents: number): number {
  return totalCents - Math.round((totalCents * 100) / (100 + IVA_RATE_PERCENT));
}

export interface PlanPrice {
  key: PlanKey;
  tier: 'PRO' | 'VIP';
  interval: 'month' | 'year';
  /** What the customer pays per period, IVA included, in centavos. */
  totalCents: number;
}

export function planPrice(key: PlanKey): PlanPrice {
  switch (key) {
    case 'pro_month':
      return { key, tier: 'PRO', interval: 'month', totalCents: withIva(LIST_CENTS.pro.month) };
    case 'pro_year':
      return { key, tier: 'PRO', interval: 'year', totalCents: withIva(LIST_CENTS.pro.year) };
    case 'vip_month':
      return { key, tier: 'VIP', interval: 'month', totalCents: withIva(LIST_CENTS.vip.month) };
  }
}

export function packPriceCents(id: PackId): number {
  return withIva(LIST_CENTS.packs[id]);
}

/**
 * Derived annual numbers (BUILD-SPEC §6.1): never stored, always computed, so
 * an IVA or price change can't leave a stale "Ahorras" behind.
 */
export function annualMath() {
  const month = planPrice('pro_month').totalCents;
  const year = planPrice('pro_year').totalCents;
  return {
    /** "(equivale a $X al mes)" — rounded to whole pesos. */
    yearMonthlyEquivalentCents: Math.round(year / 12 / 100) * 100,
    /** "vs. $X pagando mes a mes". */
    yearVsMonthlyCents: 12 * month,
    /** "Ahorras $X al año". */
    yearSavingsCents: 12 * month - year,
  };
}

/**
 * Amounts the webhook's price gate still accepts besides today's totals: the
 * IVA-less prices every subscription and checkout created before IVA was
 * added still charges. TODO(OPS): migrate those preapprovals to the new
 * amount in Mercado Pago, then empty this list.
 */
export const GRANDFATHERED_CENTS = {
  PRO: [LIST_CENTS.pro.month],
  VIP: [LIST_CENTS.vip.month],
  packs: LIST_CENTS.packs,
} as const;

export const PRICING = {
  currency: CURRENCY,
  /** Q3 · Mensual/Anual choice in the trial. */
  defaultInterval: 'year' as const,
  /** Owner trial spec: 1 month free on Pro, card required. Q26: shown as
   *  whatever MP applies. */
  trial: { days: 30, plan: 'pro' as const, requiresCard: true, reminderDaysBefore: 7 },
  /** Notice before every charge (art. 76 Bis fr. VIII: ≥ 5 calendar days). */
  reminders: { monthDaysBefore: 7, yearDaysBefore: [30, 7] as const },
  /** Q12 · terms [DÍAS DE GRACIA]. */
  graceDays: 7,
  /** Q13 · credit numbers per plan; null hides them. */
  credits: { gratis: null, pro: null, vip: null } as Record<string, number | null>,
  /** Q13 · used by error.tooLong; null hides the limit. */
  maxVideoHours: { gratis: null, pro: null, vip: null } as Record<string, number | null>,
};

/** Fails fast on a notice window shorter than the law's 5 calendar days. */
export function assertReminderWindows(p = PRICING): void {
  const days = [p.trial.reminderDaysBefore, p.reminders.monthDaysBefore, ...p.reminders.yearDaysBefore];
  const bad = days.filter((d) => d < 5);
  if (bad.length) throw new Error(`Charge notices must be ≥ 5 days before the charge (got ${bad.join(', ')})`);
}
assertReminderWindows();
