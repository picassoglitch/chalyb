// Centro de mando and Dinero numbers (rebuild P5-1, P5-3). Pure.
//
// Money follows docs/payments/money-truth.md: only settled `payments` rows
// count, months are cut in America/Mexico_City, and refunds come off the
// month of the charge they reverse. Nothing here reads a user's plan to
// infer revenue. A delta or rate on a zero / near-zero base is `null`, which
// the UI renders as "—" or "sin datos suficientes" (B18, B23).

import {
  isSettledPaymentStatus,
  summariseMoney,
  toMxnCents,
  zonedStartOfMonth,
  type MoneyRow,
} from '@/lib/billing/money';

export interface PaymentFact extends MoneyRow {
  id: string;
  user_id: string | null;
  refunded_cents: number | null;
  kind: string | null;
  plan_key: string | null;
  mp_preapproval_id: string | null;
  created_at: string;
}

export interface SubscriptionFact {
  user_id: string;
  status: string;
  plan_key: string | null;
  tier: string | null;
  mp_preapproval_id: string | null;
  trial_ends_at: string | null;
  started_at: string | null;
  created_at: string | null;
  cancel_at_period_end: boolean | null;
  cancelled_at: string | null;
}

/** Below these bases a comparison means nothing (config, not copy). */
export const MIN_BASE = {
  /** $1,000 MXN: a month under this gets no "vs mes pasado". */
  revenueCents: 100_000,
  /** Fewer finished trials than this → no conversion rate. */
  trials: 5,
};

const DAY = 86_400_000;

/** [start, end) of the Mexico City month `offset` months from `now`'s. */
export function monthWindow(now: Date, offset = 0): { start: Date; end: Date } {
  let start = zonedStartOfMonth(now);
  for (let i = 0; i < Math.abs(offset); i++) {
    start =
      offset < 0
        ? zonedStartOfMonth(new Date(start.getTime() - DAY))
        : zonedStartOfMonth(new Date(start.getTime() + 32 * DAY));
  }
  const end = zonedStartOfMonth(new Date(start.getTime() + 32 * DAY));
  return { start, end };
}

const inWindow = (iso: string | null | undefined, w: { start: Date; end: Date }) => {
  if (!iso) return false;
  const t = Date.parse(iso);
  return t >= w.start.getTime() && t < w.end.getTime();
};

export interface NetRevenue {
  /** Settled money minus refunds, MXN cents. */
  netCents: number;
  grossCents: number;
  refundedCents: number;
  /** Settled payments counted. 0 = sin datos. */
  count: number;
  usedManualFx: boolean;
}

/** Revenue of a window = settled charges − refunds on them. */
export function netRevenue(
  payments: readonly PaymentFact[],
  w: { start: Date; end: Date },
): NetRevenue {
  const rows = payments.filter((p) => inWindow(p.created_at, w));
  const gross = summariseMoney(rows);
  let refunded = 0;
  for (const p of rows)
    if (isSettledPaymentStatus(p.status)) refunded += toMxnCents(p.refunded_cents ?? 0, p.currency);
  return {
    netCents: gross.totalMxnCents - refunded,
    grossCents: gross.totalMxnCents,
    refundedCents: refunded,
    count: gross.count,
    usedManualFx: gross.usedManualFx,
  };
}

/** Relative change, or null when the base is zero or too small to compare. */
export function delta(current: number, previous: number, minBase: number): number | null {
  if (!Number.isFinite(previous) || Math.abs(previous) < Math.max(minBase, 1)) return null;
  return (current - previous) / Math.abs(previous);
}

const inTrial = (s: SubscriptionFact, now: number) =>
  s.status === 'authorized' && !!s.trial_ends_at && Date.parse(s.trial_ends_at) > now;

/** Preapprovals with at least one settled charge, and when the first was. */
function firstCharges(payments: readonly PaymentFact[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of payments) {
    if (!p.mp_preapproval_id || !isSettledPaymentStatus(p.status)) continue;
    const t = Date.parse(p.created_at);
    const prev = out.get(p.mp_preapproval_id);
    if (prev === undefined || t < prev) out.set(p.mp_preapproval_id, t);
  }
  return out;
}

export interface CommandKpis {
  revenue: NetRevenue;
  revenueDelta: number | null;
  subscribers: number;
  subscribersNew: number;
  trials: number;
  trialsEndingThisWeek: number;
  /** "De cada 10 pruebas, {n} se quedan" — null below MIN_BASE.trials. */
  conversionOf10: number | null;
  trialsFinished: number;
  trialsPaid: number;
}

export function commandKpis(
  payments: readonly PaymentFact[],
  subs: readonly SubscriptionFact[],
  now: Date,
): CommandKpis {
  const t = now.getTime();
  const month = monthWindow(now);
  const revenue = netRevenue(payments, month);
  const prev = netRevenue(payments, monthWindow(now, -1));
  const firsts = firstCharges(payments);

  const paying = subs.filter((s) => s.status === 'authorized' && !inTrial(s, t));
  const subscribersNew = paying.filter((s) => {
    const first = s.mp_preapproval_id ? firsts.get(s.mp_preapproval_id) : undefined;
    return first !== undefined && first >= month.start.getTime() && first < month.end.getTime();
  }).length;
  const trials = subs.filter((s) => inTrial(s, t));
  const finished = subs.filter((s) => s.trial_ends_at && Date.parse(s.trial_ends_at) <= t);
  const paid = finished.filter((s) => s.mp_preapproval_id && firsts.has(s.mp_preapproval_id));

  return {
    revenue,
    revenueDelta:
      prev.count === 0 ? null : delta(revenue.netCents, prev.netCents, MIN_BASE.revenueCents),
    subscribers: paying.length,
    subscribersNew,
    trials: trials.length,
    trialsEndingThisWeek: trials.filter((s) => Date.parse(s.trial_ends_at!) <= t + 7 * DAY).length,
    conversionOf10:
      finished.length >= MIN_BASE.trials ? Math.round((10 * paid.length) / finished.length) : null,
    trialsFinished: finished.length,
    trialsPaid: paid.length,
  };
}

export interface MoneyPage {
  revenue: NetRevenue;
  trialsPaid: number;
  trialsFinished: number;
  failedCharges: number;
  refunds: number;
  /** Oldest first, 6 Mexico City months ending with this one. */
  byMonth: { start: string; netCents: number; count: number }[];
  funnel: { started: number; stillTrial: number; paid: number; cancelled: number };
}

export function moneyPage(
  payments: readonly PaymentFact[],
  subs: readonly SubscriptionFact[],
  now: Date,
): MoneyPage {
  const t = now.getTime();
  const month = monthWindow(now);
  const k = commandKpis(payments, subs, now);
  const thisMonth = payments.filter((p) => inWindow(p.created_at, month));
  const firsts = firstCharges(payments);
  const started = subs.filter(
    (s) => s.trial_ends_at && inWindow(s.started_at ?? s.created_at, month),
  );
  return {
    revenue: k.revenue,
    trialsPaid: k.trialsPaid,
    trialsFinished: k.trialsFinished,
    failedCharges: thisMonth.filter((p) => p.status === 'rejected').length,
    refunds: thisMonth.filter(
      (p) => (p.refunded_cents ?? 0) > 0 || p.status === 'refunded' || p.status === 'charged_back',
    ).length,
    byMonth: [-5, -4, -3, -2, -1, 0].map((o) => {
      const w = monthWindow(now, o);
      const r = netRevenue(payments, w);
      return { start: w.start.toISOString(), netCents: r.netCents, count: r.count };
    }),
    funnel: {
      started: started.length,
      stillTrial: started.filter((s) => inTrial(s, t)).length,
      paid: started.filter((s) => s.mp_preapproval_id && firsts.has(s.mp_preapproval_id)).length,
      cancelled: started.filter((s) => s.status === 'cancelled' || s.cancel_at_period_end).length,
    },
  };
}

export type MovementState = 'charged' | 'failed' | 'refunded' | 'pending';

/** Estado for the movements table: Cobrado / Falló / Reembolsado / Pendiente. */
export function movementState(p: Pick<PaymentFact, 'status' | 'refunded_cents'>): MovementState {
  if (p.status === 'refunded' || p.status === 'charged_back' || (p.refunded_cents ?? 0) > 0)
    return 'refunded';
  if (isSettledPaymentStatus(p.status)) return 'charged';
  if (p.status === 'rejected' || p.status === 'cancelled') return 'failed';
  return 'pending';
}
