// Señales: general information, never advice (BUILD-SPEC §11.4; LMV arts.
// 225, 227; REVISION-LEGAL C1). Pure.
//
// The rules the code enforces:
//  - Signal CONTENT depends on the plan only. The function below has no user
//    parameter; the user's choices only filter what is delivered.
//  - Nothing reads balances, positions, goals or a risk profile.
//  - No copy-trading, "seguir señales", model portfolios or orders fired
//    from a signal.

import type { PlanTierKey, SenalesAdapter, Signal } from '@/lib/tools/adapters/tools';

/** Content for a plan, then the user's coin filter. The filter is applied
 *  AFTER the content is fetched, so it can never shape it. */
export async function signalsFor(
  adapter: SenalesAdapter,
  plan: PlanTierKey,
  coins: string[],
  signal?: AbortSignal,
): Promise<Signal[]> {
  const content = await adapter.getSignals({ plan }, signal);
  return coins.length ? content.filter((s) => coins.includes(s.coin)) : content;
}

/** Words that would turn information into advice. Tested over messages,
 *  emails and the built bundle. */
export const SIGNAL_FORBIDDEN = [
  /copiar autom[aá]ticamente/i,
  /seguir se[ñn]ales/i,
  /te conviene/i,
  /tu cartera/i,
  /si ya ganaste/i,
  /garantizad[oa]/i,
];

/** Data a signal feature must never read. */
export const PERSONAL_FINANCE_FIELDS =
  /risk_profile|balance|position|portfolio|investor_profile|perfil_de_riesgo/i;

/**
 * Phrases no Señales text may carry (TOOLS-SPEC §8): advice, promises or
 * talk about the person's money. Scoped to Señales text — the engine's
 * explanations before they're shown, and the signalsTool messages — because
 * words like "copiar" are fine elsewhere ("Copiar enlace" in Clips).
 */
export const SIGNAL_TEXT_BANNED: RegExp[] = [
  /te conviene/i,
  /deber[ií]as/i,
  /tu cartera/i,
  /tus ganancias/i,
  /si ya ganaste/i,
  /garantizad[oa]/i,
  /seguro que/i,
  /sin riesgo/i,
  /ganancia asegurada/i,
  /rendimiento de/i,
  /% de ganancia/i,
  /objetivo de precio/i,
  /precio objetivo/i,
  /\bcopiar\b/i,
  /invierte ahora/i,
  /no te lo pierdas/i,
  // English counterparts for the en messages.
  /you should/i,
  /your portfolio/i,
  /guaranteed/i,
  /risk[- ]free/i,
  /price target/i,
  /\bcopy\b/i,
  /invest now/i,
];

export function hasBannedSignalText(text: string): boolean {
  return SIGNAL_TEXT_BANNED.some((re) => re.test(text));
}

/** An engine text that passes, or null: the screen then shows only
 *  "Ver detalle" and the caller logs the case. */
export function screenSignalText(text: string | null | undefined): string | null {
  if (!text) return null;
  return hasBannedSignalText(text) ? null : text;
}
