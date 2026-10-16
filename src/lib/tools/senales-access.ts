// Gate for the first-activation steps (/app/senales/empezar/**): only once
// Señales is included, running and its risk notice accepted. Anything else
// goes to /app/senales, which explains the state (locked, error, the sheet).

import 'server-only';
import { redirect } from '@/i18n/routing';
import { loadTool } from './access';
import { getSenales } from './registry';
import { runTool } from './bff';
import type { SenalesAdapter, SignalPrefs } from './adapters/tools';
import type { ToolResult } from './bff-core';

export async function requireSenalesReady(locale: string, path: string) {
  const gate = await loadTool(locale, 'chalybcrypto', path, getSenales);
  if (gate.kind !== 'ready' || gate.riskPending) return redirect({ href: '/app/senales', locale });
  return gate;
}

/** The person's delivery preferences through the BFF (timeout, retries,
 *  breaker): in mode "a" they live in the engine, which can fail. */
export function loadSenalesPrefs(
  adapter: SenalesAdapter,
  userId: string,
): Promise<ToolResult<SignalPrefs | null>> {
  return runTool('chalybcrypto', userId, (signal) => adapter.getPrefs(userId, signal), {
    idempotent: true,
  });
}
