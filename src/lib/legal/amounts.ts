// Amounts in the legal texts come from src/config/pricing.ts (old P6-2,
// BUILD-SPEC §6.12). Law writes literal amounts ("$997 MXN"); when a version
// is archived (`pnpm legal:hash`) every literal is swapped for the config
// role it stands for ({{mxn:pro_month}}), and the page binds the roles back
// from config at render. Under today's config the render equals Law's text
// byte for byte; a price change changes the legal page with it.
//
// An amount that matches no role fails the archive step: the legal text
// can't promise a number the code doesn't charge.

import {
  LEALTAD,
  USD_CENTS,
  annualMath,
  lealtadSchedule,
  planPrice,
  type PlanKey,
} from '@/config/pricing';
import { formatMXN } from '@/lib/billing/format';

export interface AmountRole {
  currency: 'MXN' | 'USD';
  cents: number;
}

/** Every amount the legal texts may print, by role. Order matters when two
 *  roles share a value today (Pro mensual and Lealtad month 5 are both
 *  $997): the first role wins, so plan prices come first. */
export function legalAmountRoles(): Record<string, AmountRole> {
  const mxn = (cents: number): AmountRole => ({ currency: 'MXN', cents });
  const usd = (cents: number): AmountRole => ({ currency: 'USD', cents });
  const roles: Record<string, AmountRole> = {};
  for (const key of ['pro_month', 'pro_year', 'vip_month', 'vip_year'] as PlanKey[]) {
    roles[`mxn:${key}`] = mxn(planPrice(key).totalCents);
  }
  for (const tier of ['pro', 'vip'] as const) {
    const m = annualMath(tier);
    roles[`mxn:${tier}_12x`] = mxn(m.yearVsMonthlyCents);
    roles[`mxn:${tier}_savings`] = mxn(m.yearSavingsCents);
  }
  for (const s of lealtadSchedule()) roles[`mxn:lealtad_${s.step}`] = mxn(s.cents);
  roles['mxn:lealtad_step'] = mxn((LEALTAD.baseCents * LEALTAD.stepPct) / 100);
  roles['mxn:zero'] = mxn(0);
  for (const tier of ['pro', 'vip'] as const) {
    roles[`usd:${tier}_month`] = usd(USD_CENTS[tier].month);
    roles[`usd:${tier}_year`] = usd(USD_CENTS[tier].year);
  }
  return roles;
}

/** "$9,970", "$166.20", "US$500". */
export const AMOUNT_RE = /(US)?\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?(?![\d,])/g;

export function formatRole(role: AmountRole): string {
  const text = formatMXN(role.cents);
  return role.currency === 'USD' ? `US${text}` : text;
}

function parseLiteral(literal: string): AmountRole {
  const usd = literal.startsWith('US');
  const n = literal.replace(/^(US)?\$/, '').replace(/,/g, '');
  return { currency: usd ? 'USD' : 'MXN', cents: Math.round(Number.parseFloat(n) * 100) };
}

/** Law's text → template with {{role}} tokens. Throws on an amount no role
 *  explains (returned in `unknown` when `strict` is false). */
export function tokenizeAmounts(
  source: string,
  strict = true,
): { template: string; unknown: string[] } {
  const roles = Object.entries(legalAmountRoles());
  const unknown: string[] = [];
  const template = source.replace(AMOUNT_RE, (literal) => {
    const want = parseLiteral(literal);
    const hit = roles.find(([, r]) => r.currency === want.currency && r.cents === want.cents);
    if (!hit) {
      unknown.push(literal);
      return literal;
    }
    return `{{${hit[0]}}}`;
  });
  if (strict && unknown.length) {
    throw new Error(`legal text has amounts that pricing.ts doesn't define: ${unknown.join(', ')}`);
  }
  return { template, unknown };
}

/** Template → text with today's config amounts. */
export function bindAmounts(template: string): string {
  const roles = legalAmountRoles();
  return template.replace(/\{\{((?:mxn|usd):[a-z0-9_]+)\}\}/g, (token, name: string) => {
    const role = roles[name];
    return role ? formatRole(role) : token;
  });
}
