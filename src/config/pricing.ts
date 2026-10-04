// The ONE pricing source (rebuild prompt P2 "Config", BUILD-SPEC §6.1,
// PRICING-CARDS-SPEC §0.2 / §13 / §16).
//
// Every amount a customer sees or pays — plan cards, the trial billing
// block, Mi plan, emails, the Mercado Pago preapproval, the webhook's price
// gate, JSON-LD, the legal pages — derives from here. No component, email or
// legal text writes an amount by hand.
//
// Prices are totals, IVA included (owner, 2026-10-03; PRICING-CARDS-SPEC
// §13.2). `PRICES_INCLUDE_IVA` defaults to true IN CODE: a missing env var
// must never add 16% on top. Setting it to false would treat the amounts
// below as list prices and add IVA (only for the accountant's what-if,
// OPS-17).
//
// Amounts are integer centavos. Percentages are computed (floor), never
// typed.
//
// Pure: no imports, so client code, emails and tests can all read it.

export const CURRENCY = 'MXN';

/** TODO(accountant): 16% is the general rate; confirm for users abroad (OPS-17, O-7). */
export const IVA_RATE_PERCENT = 16;

/** What each plan costs per period, IVA included, in centavos. */
export const PRICE_CENTS = {
  pro: { month: 99_700, year: 997_000 },
  vip: { month: 379_900, year: 3_632_500 },
} as const;

/**
 * Credit packs, as totals. PRICING-CARDS-SPEC doesn't set them, so they stay
 * at what is charged today ($172.84 / $694.84 / $2,318.84) whatever
 * PRICES_INCLUDE_IVA says. TODO(owner O-4): pack prices pending owner.
 */
export const PACK_CENTS = {
  tokens_100k: 17_284,
  tokens_500k: 69_484,
  tokens_2m: 231_884,
} as const;

/**
 * The struck reference next to Pro mensual, only behind SHOW_REFERENCE_PRICE
 * (Law §16.5). TODO(owner O-3): evidence for $1,662 before turning it on.
 * There is never a USD reference.
 */
export const REFERENCE_CENTS = { pro_month: 166_200 } as const;
export const USD_REF: Readonly<Record<string, number>> = {};

/**
 * USD display amounts, plus tax, only behind USD_MARKET_ENABLED (default
 * off: MP charging in USD is unverified, OPS-14). Display only.
 */
export const USD_CENTS = {
  pro: { month: 5_000, year: 50_000 },
  vip: { month: 20_000, year: 200_000 },
} as const;

export type PlanKey = 'pro_month' | 'pro_year' | 'vip_month' | 'vip_year' | 'pro_lealtad';
export type PackId = keyof typeof PACK_CENTS;

function readBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw === '1' || raw.toLowerCase() === 'true';
}

/** Q1 · Whether the amounts above already include IVA. Owner: they do. */
export function pricesIncludeIva(): boolean {
  return readBool('PRICES_INCLUDE_IVA', true);
}

/** Customer total for an amount, in centavos (adds IVA only when the flag
 *  says the amounts exclude it). */
export function withIva(cents: number, includeIva = pricesIncludeIva()): number {
  if (includeIva) return cents;
  return Math.round((cents * (100 + IVA_RATE_PERCENT)) / 100);
}

/** The IVA contained in a total, in centavos (receipts and movements):
 *  $997 → IVA $137.52, base $859.48. */
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
      return { key, tier: 'PRO', interval: 'month', totalCents: withIva(PRICE_CENTS.pro.month) };
    case 'pro_year':
      return { key, tier: 'PRO', interval: 'year', totalCents: withIva(PRICE_CENTS.pro.year) };
    case 'vip_month':
      return { key, tier: 'VIP', interval: 'month', totalCents: withIva(PRICE_CENTS.vip.month) };
    case 'vip_year':
      return { key, tier: 'VIP', interval: 'year', totalCents: withIva(PRICE_CENTS.vip.year) };
    case 'pro_lealtad':
      // Month 1 of the schedule; later charges follow lealtadPriceCents().
      return { key, tier: 'PRO', interval: 'month', totalCents: lealtadPriceCents(0) };
  }
}

// ── Pro Lealtad (WS-7; PRICING-CARDS-SPEC §15.12, Términos §4 bis) ─────────
// A monthly Pro plan whose price drops 10% of month 1's price for every
// consecutive paid month, down to 60% less from month 7. MXN only (O-5).

export const LEALTAD = {
  baseCents: REFERENCE_CENTS.pro_month,
  stepPct: 10,
  floorPct: 60,
  /** Steps 0…6 = months 1…7+. */
  maxStep: 6,
} as const;

/** The amount of a charge at `step` (0 = month 1): linear off the base, not
 *  compounding, truncated to the whole peso so the real % is ≥ advertised. */
export function lealtadPriceCents(step: number): number {
  const s = Math.max(0, Math.min(Math.trunc(step), LEALTAD.maxStep));
  const pctOff = Math.min(s * LEALTAD.stepPct, LEALTAD.floorPct);
  return Math.floor((LEALTAD.baseCents * (100 - pctOff)) / 100 / 100) * 100;
}

export interface LealtadStep {
  /** 0-based; month = step + 1 ("7+" for the last). */
  step: number;
  cents: number;
  /** The advertised "% menos que el mes 1". */
  pct: number;
}

export function lealtadSchedule(): LealtadStep[] {
  return Array.from({ length: LEALTAD.maxStep + 1 }, (_, step) => ({
    step,
    cents: lealtadPriceCents(step),
    pct: Math.min(step * LEALTAD.stepPct, LEALTAD.floorPct),
  }));
}

/** What a subscription's next charge must be: the Lealtad step's amount, or
 *  the plan's price. */
export function chargeFor(sub: { plan_key: PlanKey | null; loyalty_step?: number | null }): number {
  if (sub.plan_key === 'pro_lealtad') return lealtadPriceCents(sub.loyalty_step ?? 0);
  return planPrice(sub.plan_key ?? 'pro_month').totalCents;
}

/**
 * What a running subscription's next charge will actually be — the amount
 * every notice, banner and Mi plan must show. Pro Lealtad: that month's
 * step. Any other plan: the amount its preapproval charges when we know it
 * (a grandfathered subscriber renews at their old price, GRANDFATHERED_CENTS,
 * until they accept a new one), else the plan's price.
 */
export function nextChargeCents(sub: {
  plan_key: PlanKey | null;
  loyalty_step?: number | null;
  amount_cents?: number | null;
}): number {
  if (sub.plan_key === 'pro_lealtad') return chargeFor(sub);
  return typeof sub.amount_cents === 'number' && sub.amount_cents > 0
    ? sub.amount_cents
    : chargeFor(sub);
}

export function packPriceCents(id: PackId): number {
  return PACK_CENTS[id];
}

export type PctRounding = 'floor' | 'round';

/** D14 · how savings and discount percentages round. Floor never overstates. */
export function pctRounding(): PctRounding {
  return process.env.PCT_ROUNDING === 'round' ? 'round' : 'floor';
}

function percent(part: number, whole: number): number {
  if (whole <= 0 || part <= 0) return 0;
  const exact = (part * 100) / whole;
  return pctRounding() === 'round' ? Math.round(exact) : Math.floor(exact);
}

/** Floor to the whole peso: "$1,994", never "$1,994.40". */
export function floorToPeso(cents: number): number {
  return Math.floor(cents / 100) * 100;
}

/**
 * Derived annual numbers (spec §13.5): never stored, always computed, so a
 * price change can't leave a stale "Ahorras" behind. Savings 0 → callers
 * render nothing.
 */
export function annualMath(tier: 'pro' | 'vip' = 'pro') {
  const month = withIva(PRICE_CENTS[tier].month);
  const year = withIva(PRICE_CENTS[tier].year);
  return {
    /** 12 × monthly. Never printed as a "vs." anchor. */
    yearVsMonthlyCents: 12 * month,
    /** "Ahorras $X al año". 0 = no line. */
    yearSavingsCents: Math.max(0, 12 * month - year),
  };
}

/** "16%" for Pro, "20%" for VIP: floor((12 × monthly − yearly) × 100 / 12 × monthly). */
export function pct(tier: 'pro' | 'vip'): number {
  const m = annualMath(tier);
  return percent(m.yearSavingsCents, m.yearVsMonthlyCents);
}

/** floor((ref − now) × 100 / ref). Argument order: (now, ref). */
export function discountPct(nowCents: number, refCents: number): number {
  return percent(refCents - nowCents, refCents);
}

/** "Ahorra hasta {pct}%": the best saving among plans offered annually now;
 *  0 = no pill. */
export function togglePct(tiers: readonly ('pro' | 'vip')[] = ['pro', 'vip']): number {
  return Math.max(0, ...tiers.map(pct));
}

/**
 * Amounts the price gate still accepts besides today's totals: what every
 * subscription created before the 2026-10-03 prices still renews at — live
 * main ($749 / $2,499) and the P5 IVA-added defaults ($868.84 / $2,898.84),
 * in case those shipped. HARD-CODED, never derived from PRICE_CENTS, or a
 * price change would refuse every existing renewal. They stay until each
 * subscriber accepts the new price (WS-6).
 */
export const GRANDFATHERED_CENTS = {
  PRO: [74_900, 86_884],
  VIP: [249_900, 289_884],
  /** The old pack amounts, for checkouts started before a change. */
  packs: {
    tokens_100k: [14_900, 17_284],
    tokens_500k: [59_900, 69_484],
    tokens_2m: [199_900, 231_884],
  },
} as const;

/** Whether a subscriber renews at an old amount (they pay less than the
 *  reference, so it is never shown to them). */
export function isGrandfatheredAmount(cents: number | null | undefined): boolean {
  const old: readonly number[] = [...GRANDFATHERED_CENTS.PRO, ...GRANDFATHERED_CENTS.VIP];
  return typeof cents === 'number' && old.includes(cents);
}

/** Earlier amounts a renewal of this plan may still charge. Yearly plans
 *  were never sold at another price, so they accept only their total. */
export function grandfatheredFor(key: PlanKey): readonly number[] {
  const p = planPrice(key);
  return p.interval === 'year' ? [] : GRANDFATHERED_CENTS[p.tier];
}

// ── Reference price (Law §16.5, behind SHOW_REFERENCE_PRICE) ────────────────

export interface ReferencePriceState {
  show: boolean;
  /** Only when show. */
  refCents?: number;
  pct?: number;
  site?: string;
  date?: string;
  promoEnd?: string;
}

/**
 * Whether the struck $1,662 may render, decided on the SERVER with `now`.
 * Off unless the flag is on AND the site, the date, the promo end and the
 * cut-off are all set AND now is before the cut-off; it switches itself off
 * then. Grandfathered subscribers never see it (they pay less).
 */
export function referencePriceState(
  now: Date,
  env: Record<string, string | undefined>,
  opts: { grandfathered?: boolean } = {},
): ReferencePriceState {
  const on = ['1', 'true'].includes((env.SHOW_REFERENCE_PRICE ?? '').toLowerCase());
  const site = env.REFERENCE_PRICE_SITE?.trim();
  const date = env.REFERENCE_PRICE_DATE?.trim();
  const promoEnd = env.REFERENCE_PRICE_PROMO_END?.trim();
  const until = Date.parse(env.REFERENCE_PRICE_UNTIL ?? '');
  if (!on || !site || !date || !promoEnd || !Number.isFinite(until) || now.getTime() >= until) {
    return { show: false };
  }
  if (opts.grandfathered) return { show: false };
  const refCents = REFERENCE_CENTS.pro_month;
  return {
    show: true,
    refCents,
    pct: discountPct(planPrice('pro_month').totalCents, refCents),
    site,
    date,
    promoEnd,
  };
}

// ── Display currency and tax footer (Law §16.7) ────────────────────────────

export type TaxRegion = 'MX' | 'US' | 'CA';

/** Which footer to show: MXN everywhere while USD_MARKET_ENABLED is off. */
export function taxRegion(
  country: string | null | undefined,
  usdMarketEnabled: boolean,
): TaxRegion {
  if (!usdMarketEnabled) return 'MX';
  const c = (country ?? '').toUpperCase();
  return c === 'US' ? 'US' : c === 'CA' ? 'CA' : 'MX';
}

export const PRICING = {
  currency: CURRENCY,
  /** Q3 · Mensual/Anual choice in the trial. */
  defaultInterval: 'year' as const,
  /** 7-day trial on EVERY plan, for first-time customers only (owner,
   *  2026-10-03, over Law's Pro-only rule: Términos §4.1 needs updating and
   *  Law's OK). Card required; one per account, person and card. The charge
   *  notice goes out on day 0, i.e. `reminderDaysBefore` (= days) before the
   *  charge: Law's ≥5-day minimum is met by one email. */
  trial: {
    days: 7,
    reminderDaysBefore: 7,
    plans: ['pro_month', 'pro_year', 'vip_month', 'vip_year'] as readonly PlanKey[],
    requiresCard: true,
    /** Owner, 2026-10-03: none. When the 7 days end, the plan is off until
     *  the first charge lands — however Mercado Pago retries, and whether or
     *  not a webhook arrives. */
    firstChargeGraceDays: 0,
  },
  /** Notice before every charge (art. 76 Bis fr. VIII: ≥ 5 calendar days). */
  reminders: { monthDaysBefore: 7, yearDaysBefore: [30, 7] as const },
  /** Q12 · terms [DÍAS DE GRACIA]. */
  graceDays: 7,
  /** Q13 · credit numbers per plan; null hides them. */
  credits: { gratis: null, pro: null, vip: null } as Record<string, number | null>,
  /** Q13 · used by error.tooLong; null hides the limit. */
  maxVideoHours: { gratis: null, pro: null, vip: null } as Record<string, number | null>,
};

/** Whether choosing this plan opens the 7-day trial (if the account and the
 *  card haven't used one): every plan in PRICING.trial.plans (owner,
 *  2026-10-03). Pro Lealtad (WS-7) stays out. */
export function planHasTrial(key: PlanKey): boolean {
  return PRICING.trial.plans.includes(key);
}

/** LFPC art. 76 Bis VIII: every charge notice at least this many calendar
 *  days before the charge. */
export const MIN_NOTICE_DAYS = 5;

/** Fails fast on a notice window shorter than the law's 5 calendar days, or
 *  a trial notice that would go out before the trial even starts. A 3-day
 *  trial can't meet the rule, so `{ days: 3, reminderDaysBefore: 3 }` throws. */
export function assertReminderWindows(
  p: {
    trial: { days: number; reminderDaysBefore: number };
    reminders: { monthDaysBefore: number; yearDaysBefore: readonly number[] };
  } = PRICING,
): void {
  const days = [
    p.trial.reminderDaysBefore,
    p.reminders.monthDaysBefore,
    ...p.reminders.yearDaysBefore,
  ];
  const bad = days.filter((d) => d < MIN_NOTICE_DAYS);
  if (bad.length)
    throw new Error(`Charge notices must be ≥ 5 days before the charge (got ${bad.join(', ')})`);
  if (p.trial.reminderDaysBefore > p.trial.days)
    throw new Error('The trial notice cannot go out before the trial starts');
}
assertReminderWindows();

/**
 * P5-6 · Whether Mensual is offered next to Anual (trial and Planes). The
 * owner panel's saved override wins over TRIAL_PLAN_CHOICE_ENABLED; anything
 * that isn't a boolean is ignored.
 */
export function resolveBillingToggle(override: unknown, envDefault: boolean): boolean {
  return typeof override === 'boolean' ? override : envDefault;
}
