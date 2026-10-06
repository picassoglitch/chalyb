// What Inicio shows (SCR-01/08), decided from entitlements alone. Pure and
// unit-tested; the page only renders it.

import type { Entitlements } from '@/lib/billing/entitlement-core';
import { paidPlanName } from '@/lib/billing/plan-label';
import { toolHref } from '@/lib/tools/routes';
import { toolBySlug } from '@/config/tools';

export type TaskKey = 'clips' | 'senales' | 'envivo' | 'mas';

export interface TaskCardModel {
  key: TaskKey;
  slug: string;
  href: string;
}

/** The three headline tools, in card order. */
const HEADLINE: { key: Exclude<TaskKey, 'mas'>; slug: string }[] = [
  { key: 'clips', slug: 'chalybclip' },
  { key: 'senales', slug: 'chalybcrypto' },
  { key: 'envivo', slug: 'chalybobs' },
];

/** Every tool opens inside the app (TOOLS-SPEC §0.1). */
function hrefFor(key: TaskKey, slug: string): string {
  if (key === 'mas') return '/app/herramientas';
  return toolHref(slug);
}

/**
 * Cards for every visible headline tool, plus "Más herramientas" only when at
 * least one OTHER tool is visible and works (`live` in config/tools.ts;
 * TOOLS-SPEC §2, F7, Q9). BUILD-SPEC §0.3: no dead-end cards.
 * `visibleSlugs` is the catalog order of the tools in entitlements.tools.
 */
export function selectTaskCards(visibleSlugs: string[]): {
  cards: TaskCardModel[];
  extraSlugs: string[];
} {
  const visible = new Set(visibleSlugs);
  const cards: TaskCardModel[] = HEADLINE.filter((h) => visible.has(h.slug)).map((h) => ({
    ...h,
    href: hrefFor(h.key, h.slug),
  }));
  const headline = new Set(HEADLINE.map((h) => h.slug));
  const extraSlugs = visibleSlugs.filter((s) => !headline.has(s) && toolBySlug(s)?.live === true);
  if (extraSlugs.length > 0)
    cards.push({ key: 'mas', slug: 'more', href: hrefFor('mas', 'more') });
  return { cards, extraSlugs };
}

export type PlanStrip =
  /** Everything visible is included: chips of the first four + "y N más". */
  | { kind: 'included'; plan: 'Pro' | 'VIP'; chips: string[]; more: number }
  /** Pro while it still runs one tool at a time (Q7 flag off). */
  | { kind: 'single'; tools: string[] }
  /** Free: the way to Pro. `trial` only when the trial path exists AND Pro
   *  really includes every tool; otherwise a plain "see plans". */
  | { kind: 'offer'; cta: 'trial' | 'return' | 'plans' };

export function selectPlanStrip(
  e: Pick<Entitlements, 'plan' | 'trialUsed' | 'tools'>,
  toolNames: Record<string, string>,
  flags: { proIncludesAllTools: boolean; trialFlow: boolean },
): PlanStrip {
  const visible = Object.keys(e.tools);
  const included = visible.filter((s) => e.tools[s]!.state === 'included');
  const names = (slugs: string[]) => slugs.map((s) => toolNames[s] ?? s);

  if (e.plan === 'FREE') {
    if (!flags.trialFlow || !flags.proIncludesAllTools) return { kind: 'offer', cta: 'plans' };
    return { kind: 'offer', cta: e.trialUsed ? 'return' : 'trial' };
  }
  if (included.length === visible.length && visible.length > 0) {
    const all = names(visible);
    return {
      kind: 'included',
      plan: paidPlanName(e.plan),
      chips: all.slice(0, 4),
      more: Math.max(0, all.length - 4),
    };
  }
  return { kind: 'single', tools: names(included) };
}
