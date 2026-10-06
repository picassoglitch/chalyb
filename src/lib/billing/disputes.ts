// Refunds and chargebacks (WS-8; REVISION §S; Términos de Suscripción §7 and
// §10; aceptacion-ux §10.5). Pure: the rules and dates, no I/O. The server
// half is disputes-server.ts.
//
// The policy in one line: refunds only in the legal cases, exercising a right
// never costs the user anything, and measures exist only for a bad-faith
// chargeback, after a notice and 10 business days.

import { isMxBusinessDay, MX_UTC_OFFSET_HOURS } from '@/config/holidays-mx';

/** Términos §7.2 (a)–(i): the only reasons a refund is issued. There is no
 *  courtesy refund (§7.4). */
export const REFUND_REASONS = [
  'legal_7_2_a', // cobro no autorizado o sin consentimiento expreso
  'legal_7_2_b', // cobro sin el aviso entregado con ≥5 días naturales
  'legal_7_2_c', // cobro después de cancelar
  'legal_7_2_d', // duplicado, error o monto mayor al informado o convenido
  'legal_7_2_e', // servicio no prestado o deficiente por causas de Chalyb
  'legal_7_2_f', // oferta o condiciones no respetadas
  'legal_7_2_g', // cierre sin causa, retiro de una función esencial
  'legal_7_2_h', // revocación (art. 56 LFPC), cuando aplique
  'legal_7_2_i', // cualquier otro caso que ordene la ley o una autoridad
] as const;
export type RefundReason = (typeof REFUND_REASONS)[number];

export function isRefundReason(v: unknown): v is RefundReason {
  return typeof v === 'string' && (REFUND_REASONS as readonly string[]).includes(v);
}

// ── Business days ─────────────────────────────────────────────────────────

const HOUR = 3_600_000;
const pad = (n: number) => String(n).padStart(2, '0');

/** The Mexico City calendar day of an instant, as [y, m(0-based), d]. */
function mxDay(at: Date): [number, number, number] {
  const local = new Date(at.getTime() + MX_UTC_OFFSET_HOURS * HOUR);
  return [local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()];
}

/**
 * The end (23:59:59.999, Mexico City) of the n-th business day after `from`.
 * The day of `from` itself never counts; weekends and official rest days
 * (config/holidays-mx.ts) are skipped. Used for the 10 días hábiles of the
 * chargeback notice and the 5 of an overcharge refund.
 */
export function addMxBusinessDays(from: Date, n: number): Date {
  let [y, m, d] = mxDay(from);
  let counted = 0;
  while (counted < n) {
    d += 1;
    const next = new Date(Date.UTC(y, m, d));
    [y, m, d] = [next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate()];
    if (isMxBusinessDay(`${y}-${pad(m + 1)}-${pad(d)}`)) counted += 1;
  }
  return new Date(Date.UTC(y, m, d + 1) - MX_UTC_OFFSET_HOURS * HOUR - 1);
}

/** Términos §10.5: the user has 10 business days from the notice. */
export const NOTICE_BUSINESS_DAYS = 10;
/** §7.2(d) / LFPC art. 91: an overcharge goes back within 5 business days. */
export const OVERCHARGE_REFUND_BUSINESS_DAYS = 5;

export function noticeDeadline(sentAt: Date): Date {
  return addMxBusinessDays(sentAt, NOTICE_BUSINESS_DAYS);
}

// ── Triage (aceptacion-ux §10.5 step 1) ──────────────────────────────────

export interface TriageInput {
  /** A trial_started / subscription_started / lealtad_started /
   *  price_change_accepted record covers this charge. */
  consentOnRecord: boolean;
  /** Signs of a stolen card: never contest (§7.2(a)). */
  unauthorizedSignals: boolean;
  /** Whether this charge needed a prior notice (renewals, end of trial,
   *  Lealtad steps; a pack bought on the spot does not). */
  noticeRequired: boolean;
  /** Days between the delivered notice and the charge; null = none delivered. */
  noticeDeliveredDaysBefore: number | null;
  cancelledBeforeCharge: boolean;
  /** Duplicate, error, or an amount other than the one shown or scheduled. */
  amountMismatch: boolean;
  /** A serious failure attributable to Chalyb in the charged period. */
  serviceFailure: boolean;
}

export type Triage =
  | { result: 'legal_refund'; reason: RefundReason }
  | { result: 'contest' };

/** A §7.2 case is never contested: accept or refund, close, no notice, no
 *  measure. Only an authorized, notified, uncancelled, correct charge for a
 *  service that worked is contested. */
export function triage(i: TriageInput): Triage {
  if (!i.consentOnRecord || i.unauthorizedSignals)
    return { result: 'legal_refund', reason: 'legal_7_2_a' };
  if (i.noticeRequired && (i.noticeDeliveredDaysBefore === null || i.noticeDeliveredDaysBefore < 5))
    return { result: 'legal_refund', reason: 'legal_7_2_b' };
  if (i.cancelledBeforeCharge) return { result: 'legal_refund', reason: 'legal_7_2_c' };
  if (i.amountMismatch) return { result: 'legal_refund', reason: 'legal_7_2_d' };
  if (i.serviceFailure) return { result: 'legal_refund', reason: 'legal_7_2_e' };
  return { result: 'contest' };
}

// ── Bad faith (Términos §10.4; REVISION S.4 #5) ───────────────────────────

export interface BadFaithInput {
  consentOnRecord: boolean;
  /** The charge is a §7.2 case (triage said legal_refund). */
  legalCase: boolean;
  usedInPeriod: boolean;
  cancelledBeforeCharge: boolean;
  resolution: 'won' | 'lost' | null;
  /** The disputed amount is still owed (relevant when resolved `lost`). */
  unpaid: boolean;
  noticeSentAt: Date | null;
  deadline: Date | null;
  now: Date;
  /** The user paid the amount. */
  paid: boolean;
  /** The user answered and showed the charge wasn't owed. */
  responseAccepted: boolean;
}

/** True only when EVERY condition of §10.4 holds. */
export function isBadFaith(i: BadFaithInput): boolean {
  return (
    i.consentOnRecord &&
    !i.legalCase &&
    i.usedInPeriod &&
    !i.cancelledBeforeCharge &&
    (i.resolution === 'won' || (i.resolution === 'lost' && i.unpaid)) &&
    i.noticeSentAt !== null &&
    i.deadline !== null &&
    i.now.getTime() >= i.deadline.getTime() &&
    !i.paid &&
    !i.responseAccepted
  );
}

export type BadFaithDecision = 'bad_faith' | 'none' | 'pending';

/** The written decision of §10.5 / step 4. `pending` = not yet decidable
 *  (no notice, or the 10 business days are still running). Paying or an
 *  accepted answer before the deadline closes the case with no measure. */
export function decide(i: BadFaithInput): BadFaithDecision {
  if (i.paid || i.responseAccepted) return 'none';
  if (!i.consentOnRecord || i.legalCase || !i.usedInPeriod || i.cancelledBeforeCharge)
    return 'none';
  if (i.resolution === 'lost' && !i.unpaid) return 'none';
  if (i.resolution === null || i.noticeSentAt === null || i.deadline === null) return 'pending';
  if (i.now.getTime() < i.deadline.getTime()) return 'pending';
  return isBadFaith(i) ? 'bad_faith' : 'none';
}

// ── Measures (Términos §10.6, §10.8; R-4) ─────────────────────────────────

export type MeasureKind = 'restricted' | 'prepayment_required' | 'closed';

/**
 * What a decision allows, given the flags. Nothing unless the decision is
 * bad_faith AND CHARGEBACK_MEASURES_ENABLED. Paid features are suspended only
 * while something is owed ("hasta que se pague"); prepayment for a new paid
 * plan follows every bad_faith decision. Closing is separate (closeDue).
 */
export function measuresFor(
  decision: BadFaithDecision,
  input: { measuresEnabled: boolean; unpaid: boolean },
): MeasureKind[] {
  if (!input.measuresEnabled || decision !== 'bad_faith') return [];
  return input.unpaid ? ['restricted', 'prepayment_required'] : ['prepayment_required'];
}

/** §10.6(b): close only when still unpaid N days after the restriction, or
 *  on a repeat bad-faith case. Never while the measures flag is off. */
export function closeDue(input: {
  measuresEnabled: boolean;
  restrictedAt: Date | null;
  unpaid: boolean;
  repeatBadFaith: boolean;
  closeAfterDays: number;
  now: Date;
}): boolean {
  if (!input.measuresEnabled) return false;
  if (input.repeatBadFaith) return true;
  if (!input.restrictedAt || !input.unpaid) return false;
  return input.now.getTime() - input.restrictedAt.getTime() >= input.closeAfterDays * 86_400_000;
}

/** A row of account_restrictions. Active while lifted_at is null. */
export interface RestrictionRow {
  kind: MeasureKind;
  set_at: string;
  lifted_at: string | null;
}

export interface RestrictionState {
  /** Paid features off (restricted or closed). */
  paidSuspended: boolean;
  /** A new paid plan must be paid before it starts, with no trial. */
  prepaymentRequired: boolean;
  closed: boolean;
}

export function restrictionState(rows: readonly RestrictionRow[]): RestrictionState {
  const active = rows.filter((r) => !r.lifted_at).map((r) => r.kind);
  const closed = active.includes('closed');
  return {
    paidSuspended: closed || active.includes('restricted'),
    prepaymentRequired: active.includes('prepayment_required'),
    closed,
  };
}

/** The user can ALWAYS download their content (clips, results, exports),
 *  restricted or closed alike (Términos §10.6). */
export function contentDownloadAllowed(state: RestrictionState): true {
  void state;
  return true;
}

// ── Admin view ────────────────────────────────────────────────────────────

export type DisputeStage =
  | 'legal_closed' // §7.2 case: not contested, no notice, no measure
  | 'awaiting_resolution' // contested; Mercado Pago hasn't resolved it
  | 'ready_for_notice' // resolved; the §10.5 notice can go out
  | 'notice_running' // the 10 business days are running
  | 'decided_none'
  | 'decided_bad_faith';

export function disputeStage(cb: {
  triage: string | null;
  resolution: string | null;
  notice_sent_at: string | null;
  decision: string | null;
}): DisputeStage {
  if (cb.decision === 'bad_faith') return 'decided_bad_faith';
  if (cb.decision === 'none') return 'decided_none';
  if (cb.triage === 'legal_refund') return 'legal_closed';
  if (!cb.resolution) return 'awaiting_resolution';
  if (!cb.notice_sent_at) return 'ready_for_notice';
  return 'notice_running';
}

// ── Refund claims (one refund, once) ───────────────────────────────────────

/** The ledger operations a refund claim needs: read a charge, and move its
 *  refunded total only if nobody moved it since (compare-and-set). */
export interface RefundLedger {
  read(paymentId: string): Promise<{ amountCents: number; refundedCents: number } | null>;
  /** Sets refunded_cents to `to` where it is still `from`; whether it did. */
  swap(paymentId: string, from: number, to: number): Promise<boolean>;
}

export type RefundClaim =
  /** Reserved on the ledger: refund exactly `cents`, starting at `offset`. */
  | { kind: 'claimed'; cents: number; offset: number }
  /** Nothing left to refund on this charge. */
  | { kind: 'nothing_left' }
  /** No ledger row for the charge: refund as asked, nothing to reserve. */
  | { kind: 'unledgered'; cents: number }
  /** Lost the race too many times: try again later. */
  | { kind: 'contended' };

/**
 * Reserves a refund on the ledger BEFORE Mercado Pago is asked, so two
 * concurrent refunds of one charge (a replayed webhook, a double click) can't
 * both go out: only one compare-and-set wins each offset, the other re-reads
 * and gets what is left — never past the charge.
 */
export async function claimRefund(
  ledger: RefundLedger,
  paymentId: string,
  cents: number,
  attempts = 5,
): Promise<RefundClaim> {
  for (let i = 0; i < attempts; i++) {
    const pay = await ledger.read(paymentId);
    if (!pay) return { kind: 'unledgered', cents };
    const take = Math.min(cents, pay.amountCents - pay.refundedCents);
    if (take <= 0) return { kind: 'nothing_left' };
    if (await ledger.swap(paymentId, pay.refundedCents, pay.refundedCents + take)) {
      return { kind: 'claimed', cents: take, offset: pay.refundedCents };
    }
  }
  return { kind: 'contended' };
}

/** Gives back a claim Mercado Pago refused (same compare-and-set, so a
 *  claim made meanwhile is kept). */
export async function releaseRefund(
  ledger: RefundLedger,
  paymentId: string,
  cents: number,
  attempts = 5,
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    const pay = await ledger.read(paymentId);
    if (!pay) return false;
    if (await ledger.swap(paymentId, pay.refundedCents, Math.max(0, pay.refundedCents - cents))) {
      return true;
    }
  }
  return false;
}

/** Mercado Pago's idempotency key for a refund: the same claim always sends
 *  the same key (a retried request can't refund twice); a later refund of
 *  the same amount starts at another offset, so it isn't mistaken for it. */
export function refundIdempotencyKey(input: {
  paymentId: string;
  reason: string;
  cents: number;
  offset: number;
}): string {
  return `refund:${input.paymentId}:${input.reason}:${input.cents}:${input.offset}`;
}
