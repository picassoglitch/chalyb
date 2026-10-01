// Which top banner shows (SCR-17, BUILD-SPEC §6.8): one at a time, priority
// past_due > last 7 days of the trial > renewal in 7 days > trial active >
// trial ended. Pure.

import type { BillingState } from './billing-state';

const DAY = 86_400_000;

export type BannerKind = 'pastDue' | 'last7' | 'renew' | 'trial' | 'ended';

export interface BannerChoice {
  kind: BannerKind;
  tone: 'bad' | 'warn' | 'trial' | 'gray';
  /** last7, renew and pastDue can't be closed. */
  closable: boolean;
  /** Whether this banner is the in-app copy of a mandatory pre-charge
   *  notice (the bounce rule's alternate channel). */
  mandatoryNotice: boolean;
  cta: 'plan' | 'card' | 'return';
}

export function selectBanner(
  s: BillingState,
  trialUsed: boolean,
  nowMs: number,
): BannerChoice | null {
  if (s.state === 'past_due') {
    return { kind: 'pastDue', tone: 'bad', closable: false, mandatoryNotice: false, cta: 'card' };
  }
  if (s.state === 'trialing' && s.trialEndsAt) {
    const left = Date.parse(s.trialEndsAt) - nowMs;
    if (left <= 7 * DAY)
      return { kind: 'last7', tone: 'warn', closable: false, mandatoryNotice: true, cta: 'plan' };
    return { kind: 'trial', tone: 'trial', closable: true, mandatoryNotice: false, cta: 'plan' };
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
