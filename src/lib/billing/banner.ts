// Which top banner shows (SCR-17, BUILD-SPEC §6.8, mockup 17): one at a
// time, priority past_due > notice not delivered (hold) > trial tomorrow
// (TRIAL_DAY6_REMINDER) > trial active > renewal in 7 days > trial ended.
// Pure.

import { NOTICE_DEADLINE_MS } from './reminders';
import type { BillingState } from './billing-state';

const DAY = 86_400_000;

export type BannerKind = 'pastDue' | 'noticeHold' | 'trialTomorrow' | 'trial' | 'renew' | 'ended';

export interface BannerChoice {
  kind: BannerKind;
  tone: 'bad' | 'warn' | 'trial' | 'gray';
  /** Only "trial ended" can be closed: the rest carry a charge. */
  closable: boolean;
  /** Whether this banner is the in-app copy of a mandatory pre-charge
   *  notice (the bounce rule's alternate channel). */
  mandatoryNotice: boolean;
  cta: 'plan' | 'card' | 'return' | 'email';
}

/** The mandatory notice for the next charge isn't confirmed delivered and
 *  the deadline (charge − 5 days) has passed, or a hold is already on. */
export function noticeUndelivered(s: BillingState, nowMs: number): boolean {
  if (s.state !== 'trialing' && s.state !== 'pro') return false;
  if (s.chargeHoldUntil && nowMs < Date.parse(s.chargeHoldUntil)) return true;
  if (s.reminderDeliveredAt || !s.nextChargeAt) return false;
  const charge = Date.parse(s.nextChargeAt);
  return nowMs >= charge - NOTICE_DEADLINE_MS && nowMs < charge;
}

export function selectBanner(
  s: BillingState,
  trialUsed: boolean,
  nowMs: number,
  opts: { day6Enabled?: boolean } = {},
): BannerChoice | null {
  if (s.state === 'past_due') {
    return { kind: 'pastDue', tone: 'bad', closable: false, mandatoryNotice: false, cta: 'card' };
  }
  // TODO(owner O-8): the "Aviso no entregado" wording is pending Law.
  if (noticeUndelivered(s, nowMs)) {
    return {
      kind: 'noticeHold',
      tone: 'warn',
      closable: false,
      mandatoryNotice: false,
      cta: 'email',
    };
  }
  if (s.state === 'trialing' && s.trialEndsAt) {
    const left = Date.parse(s.trialEndsAt) - nowMs;
    if (opts.day6Enabled && left > 0 && left <= DAY) {
      return {
        kind: 'trialTomorrow',
        tone: 'warn',
        closable: false,
        mandatoryNotice: true,
        cta: 'plan',
      };
    }
    // Amber for the whole trial: the charge is never more than 7 days away.
    return { kind: 'trial', tone: 'warn', closable: false, mandatoryNotice: true, cta: 'plan' };
  }
  if (s.state === 'pro' && s.nextChargeAt) {
    const left = Date.parse(s.nextChargeAt) - nowMs;
    if (left > 0 && left <= 7 * DAY) {
      return { kind: 'renew', tone: 'warn', closable: false, mandatoryNotice: true, cta: 'plan' };
    }
  }
  if (s.state === 'free' && trialUsed) {
    return { kind: 'ended', tone: 'gray', closable: true, mandatoryNotice: false, cta: 'return' };
  }
  return null;
}
