// Amounts in the legal texts come from src/config/pricing.ts (old P6-2,
// BUILD-SPEC §6.12). Law writes literal amounts ("$997 MXN"); when a version
// is archived (`pnpm legal:hash`) every literal is swapped for the config
// role it stands for ({{mxn:pro_month}}), and the page binds the roles back
// from config at render. Under today's config the render equals Law's text
// byte for byte; a price change changes the legal page with it.
//
// An amount that matches no role fails the archive step: the legal text
// can't promise a number the code doesn't charge. An amount that matches
// two roles today (Pro mensual and Lealtad month 5 are both $997) is never
// guessed: registry.json lists, per version, the role of each of its
// occurrences in order (`amountRoles`), and the archive step fails while
// one is missing or the count doesn't match.

import {
  LEALTAD,
  PACK_CENTS,
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

/** Every amount the legal texts may print, by role. */
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
  roles['mxn:pack_100k'] = mxn(PACK_CENTS.tokens_100k);
  roles['mxn:pack_500k'] = mxn(PACK_CENTS.tokens_500k);
  roles['mxn:pack_2m'] = mxn(PACK_CENTS.tokens_2m);
  for (const tier of ['pro', 'vip'] as const) {
    roles[`usd:${tier}_month`] = usd(USD_CENTS[tier].month);
    roles[`usd:${tier}_year`] = usd(USD_CENTS[tier].year);
  }
  return roles;
}

/** A bracket that isn't a Markdown link's text: an owner/attorney note. */
const OWNER_NOTE_RE = /\[[^[\]]*\](?!\()/g;

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

/** Per literal ("$997"), the role of each occurrence, in order. */
export type AmountRoleMap = Readonly<Record<string, readonly string[]>>;

/**
 * Law's text → template with {{role}} tokens. Collects every problem:
 * `unknown` (no role has that value), `ambiguous` (several roles do and
 * `explicit` doesn't say which, or its count is off), `invalid` (an explicit
 * role that doesn't have that value). With `strict`, any problem throws.
 */
export function tokenizeAmounts(
  source: string,
  explicit: AmountRoleMap = {},
  strict = true,
): { template: string; unknown: string[]; ambiguous: string[]; invalid: string[] } {
  const roles = Object.entries(legalAmountRoles());
  const unknown: string[] = [];
  const ambiguous: string[] = [];
  const invalid: string[] = [];
  const seen = new Map<string, number>();
  const counts = new Map<string, number>();
  // An amount no role explains is allowed only inside an unfinished bracket
  // ("[NOTA PARA EL DUEÑO: … si son antes de IVA, $149 …]"): that is Law
  // talking to the owner, not a price the text promises, and the publish gate
  // refuses the text while the bracket is there. It stays a literal.
  const notes = [...source.matchAll(OWNER_NOTE_RE)].map((m) => [m.index, m.index + m[0].length]);
  const inNote = (at: number) => notes.some(([a, b]) => at > a! && at < b!);
  for (const m of source.matchAll(AMOUNT_RE)) counts.set(m[0], (counts.get(m[0]) ?? 0) + 1);
  const template = source.replace(AMOUNT_RE, (literal, ...rest) => {
    const want = parseLiteral(literal);
    const hits = roles.filter(([, r]) => r.currency === want.currency && r.cents === want.cents);
    const i = seen.get(literal) ?? 0;
    seen.set(literal, i + 1);
    if (!hits.length) {
      if (!inNote(rest[rest.length - 2] as number)) unknown.push(literal);
      return literal;
    }
    const list = explicit[literal];
    if (list) {
      if (list.length !== counts.get(literal)) {
        if (i === 0)
          ambiguous.push(
            `${literal} (${counts.get(literal)} occurrences, ${list.length} roles listed)`,
          );
        return literal;
      }
      const name = list[i]!;
      if (!hits.some(([k]) => k === name)) {
        invalid.push(`${literal} #${i + 1} → ${name}`);
        return literal;
      }
      return `{{${name}}}`;
    }
    if (hits.length > 1) {
      if (i === 0) ambiguous.push(`${literal} (${hits.map(([k]) => k).join(' | ')})`);
      return literal;
    }
    return `{{${hits[0]![0]}}}`;
  });
  if (strict && (unknown.length || ambiguous.length || invalid.length)) {
    const parts = [
      unknown.length ? `not in pricing.ts: ${unknown.join(', ')}` : '',
      ambiguous.length
        ? `ambiguous, list them in registry.json amountRoles: ${ambiguous.join(', ')}`
        : '',
      invalid.length ? `wrong role: ${invalid.join(', ')}` : '',
    ].filter(Boolean);
    throw new Error(`legal amounts: ${parts.join('; ')}`);
  }
  return { template, unknown, ambiguous, invalid };
}

/** Template → text with today's config amounts. */
export function bindAmounts(template: string): string {
  const roles = legalAmountRoles();
  return template.replace(/\{\{((?:mxn|usd):[a-z0-9_]+)\}\}/g, (token, name: string) => {
    const role = roles[name];
    return role ? formatRole(role) : token;
  });
}
