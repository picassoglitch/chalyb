// Who gets the 7-day trial (owner, 2026-10-03): first-time customers only —
// one per account and one per card. Pure.

/**
 * Whether the account has used its trial, or never may: a trial already
 * started, a prepayment restriction (WS-8), or any plan it was ever charged
 * for (a returning customer is not a first-time one).
 */
export function trialUsedFrom(input: {
  trialStartedAt: string | null | undefined;
  prepaymentRequired: boolean;
  chargedBefore: boolean;
}): boolean {
  return !!input.trialStartedAt || input.prepaymentRequired || input.chargedBefore;
}

/**
 * The one-trial-per-card rule. A card we can't fingerprint gets no trial
 * (fail closed). `seenUserId`: undefined = not looked up yet, null = no
 * account has used this card.
 */
export function trialCardCheck(input: {
  mode: 'trial' | 'paid' | 'change';
  fingerprint: string | null;
  seenUserId: string | null | undefined;
  userId: string;
}): { ok: true } | { ok: false; code: 'CARD_UNVERIFIED' | 'CARD_TRIAL_USED' } {
  if (input.mode !== 'trial') return { ok: true };
  if (!input.fingerprint) return { ok: false, code: 'CARD_UNVERIFIED' };
  if (input.seenUserId && input.seenUserId !== input.userId) {
    return { ok: false, code: 'CARD_TRIAL_USED' };
  }
  return { ok: true };
}
