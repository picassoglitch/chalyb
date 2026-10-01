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
): Promise<Signal[]> {
  const content = await adapter.getSignals({ plan });
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
