// Autopublish (P3-3, aceptacion-ux §7). Pure.
//
// OFF by default. Turning it on needs: a connected account, the plan's cap
// (TIER_CAPS.clipAutoPublish — VIP today, Q15), and the §7 checkbox. The
// server applies the same decision before writing `autopublish_enabled`.

export const AUTOPUBLISH_DEFAULT = false;

export type AutopublishDecision =
  | { ok: true }
  | { ok: false; reason: 'no_account' | 'needs_vip' | 'consent_required' | 'not_supported' };

export function decideAutopublish(input: {
  supportsConnect: boolean;
  account: string | null | undefined;
  capAllows: boolean;
  checked: unknown;
}): AutopublishDecision {
  if (!input.supportsConnect) return { ok: false, reason: 'not_supported' };
  if (!input.account || !input.account.trim()) return { ok: false, reason: 'no_account' };
  if (!input.capAllows) return { ok: false, reason: 'needs_vip' };
  if (input.checked !== true) return { ok: false, reason: 'consent_required' };
  return { ok: true };
}
