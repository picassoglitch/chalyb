// Publish blockers where Law's text and the code's config must say the same
// thing (7a review of WS-12). They never rewrite Law's text: they keep
// LEGAL_PUBLISH from taking effect until the text (with Law's OK) or the
// config changes.
//
// - Suscripción §2.1 names, positively, every plan in PRICING.trial.plans
//   (owner, 2026-10-03: every plan, first time only). A plan named only to
//   exclude it ("no para VIP", "excepto VIP") doesn't count.
// - Nowhere in Suscripción does a sentence say a trial plan has no trial
//   ("VIP anual no incluye Prueba gratis", "sin prueba").
// - §8.2's "[DÍAS DE GRACIA] días naturales", once filled, equals
//   PRICING.graceDays.
// - PRICING.trial.firstChargeGraceDays = 0 (no grace after the trial): §8
//   says explicitly that its grace doesn't apply to the charge that ends the
//   Prueba (TRIAL_GRACE_EXCLUSION), not merely mentions the Prueba.

import { PRICING, type PlanKey } from '@/config/pricing';

const PLAN_LABEL: Record<PlanKey, RegExp> = {
  pro_month: /\bPro mensual\b/i,
  pro_year: /\bPro anual\b/i,
  // "VIP" or "VIP mensual", never "VIP anual".
  vip_month: /\bVIP(?! anual)\b/i,
  vip_year: /\bVIP anual\b/i,
  pro_lealtad: /\bPro Lealtad\b/i,
};

/** "no incluye Prueba", "no incluye la prueba", "sin prueba". */
const NO_TRIAL = /no incluye (la )?prueba|sin prueba/i;

/** Clauses that name a plan to leave it out: "(no para VIP)", "excepto VIP
 *  anual", "salvo VIP", "ni VIP". Cut before checking what §2.1 offers. */
const EXCLUSION_CLAUSE =
  /\b(?:no (?:para|en|incluye|aplica a)|excepto|salvo|ni|con excepción de)\b[^.;:()]*/gi;

/**
 * §8 must say, in one sentence, that the grace period doesn't apply to the
 * charge that ends the Prueba. Either order:
 *   "El periodo de gracia no aplica al cobro con el que termina la Prueba."
 *   "Al cobro que termina la Prueba no se aplica el periodo de gracia."
 */
export const TRIAL_GRACE_EXCLUSION = [
  /periodo de gracia[^.]{0,80}\bno (?:se )?aplica\b[^.]{0,60}\b(?:cobro|cargo)\b[^.]{0,60}\btermin\w*[^.]{0,20}\bPrueba\b/i,
  /\b(?:cobro|cargo)\b[^.]{0,60}\btermin\w*[^.]{0,20}\bPrueba\b[^.]{0,60}\bno (?:se )?(?:aplica|tiene|hay)\b[^.]{0,40}periodo de gracia/i,
];

function section(text: string, n: string): string {
  const start = text.search(new RegExp(`^## ${n}\\.`, 'm'));
  if (start < 0) return '';
  const rest = text.slice(start + 3);
  const end = rest.search(/^## /m);
  return end < 0 ? rest : rest.slice(0, end);
}

const plain = (s: string) => s.replace(/\*\*|__|\*/g, '');

/** Sentences (and list items / table cells) of a Markdown text. */
function sentences(text: string): string[] {
  return plain(text)
    .split(/\n+|(?<=[.;])\s+|\s\|\s/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Problems in the Términos de Suscripción text (its rendered Markdown). */
export function subscriptionConsistency(
  text: string,
  config: { trialPlans: readonly PlanKey[]; graceDays: number; firstChargeGraceDays: number } = {
    trialPlans: PRICING.trial.plans,
    graceDays: PRICING.graceDays,
    firstChargeGraceDays: PRICING.trial.firstChargeGraceDays,
  },
): string[] {
  const out: string[] = [];

  const s2 = plain(section(text, '2'));
  const offer = (/^2\.1\..*$/m.exec(s2)?.[0] ?? s2).replace(EXCLUSION_CLAUSE, ' ');
  const missing = config.trialPlans.filter((k) => !PLAN_LABEL[k].test(offer));
  if (missing.length) out.push(`trial-plans:${missing.join(',')}`);

  const excluded = config.trialPlans.filter((k) =>
    sentences(text).some((s) => NO_TRIAL.test(s) && PLAN_LABEL[k].test(s)),
  );
  if (excluded.length) out.push(`trial-excluded:${excluded.join(',')}`);

  const s8 = section(text, '8');
  const grace = /\*\*(\d+|\[[^\]]+\]) días naturales\*\*/.exec(s8)?.[1];
  if (grace && /^\d+$/.test(grace) && Number(grace) !== config.graceDays) {
    out.push(`grace-days:${grace}!=${config.graceDays}`);
  }
  if (
    config.firstChargeGraceDays === 0 &&
    !sentences(s8).some((s) => TRIAL_GRACE_EXCLUSION.some((re) => re.test(s)))
  ) {
    out.push('trial-grace');
  }
  return out;
}
