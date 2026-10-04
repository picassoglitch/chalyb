// Publish blockers where Law's text and the code's config must say the same
// thing (7a review of WS-12). They never rewrite Law's text: they keep
// LEGAL_PUBLISH from taking effect until the text (with Law's OK) or the
// config changes.
//
// - Suscripción §2.1 names the plans the 7-day trial is on;
//   PRICING.trial.plans is what the code offers (owner, 2026-10-03: every
//   plan, first time only).
// - Suscripción §8.2's "[DÍAS DE GRACIA] días naturales", once filled, must
//   equal PRICING.graceDays.
// - PRICING.trial.firstChargeGraceDays = 0 (no grace after the trial):
//   §8 must say its grace doesn't apply to the charge that ends the trial.

import { PRICING, type PlanKey } from '@/config/pricing';

const PLAN_LABEL: Record<PlanKey, RegExp> = {
  pro_month: /Pro mensual/i,
  pro_year: /Pro anual/i,
  vip_month: /VIP(?: mensual)?(?! anual)/i,
  vip_year: /VIP anual/i,
  pro_lealtad: /Pro Lealtad/i,
};

function section(text: string, n: string): string {
  const start = text.search(new RegExp(`^## ${n}\\.`, 'm'));
  if (start < 0) return '';
  const rest = text.slice(start + 3);
  const end = rest.search(/^## /m);
  return end < 0 ? rest : rest.slice(0, end);
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
  const s2 = section(text, '2');
  const offer = /^2\.1\..*$/m.exec(s2)?.[0] ?? s2;
  const missing = config.trialPlans.filter((k) => !PLAN_LABEL[k].test(offer));
  if (missing.length) out.push(`trial-plans:${missing.join(',')}`);

  const s8 = section(text, '8');
  const grace = /\*\*(\d+|\[[^\]]+\]) días naturales\*\*/.exec(s8)?.[1];
  if (grace && /^\d+$/.test(grace) && Number(grace) !== config.graceDays) {
    out.push(`grace-days:${grace}!=${config.graceDays}`);
  }
  if (config.firstChargeGraceDays === 0 && s8 && !/Prueba/i.test(s8)) {
    out.push('trial-grace');
  }
  return out;
}
