// Gate for the first-activation steps (/app/senales/empezar/**): only once
// Señales is included, running and its risk notice accepted. Anything else
// goes to /app/senales, which explains the state (locked, error, the sheet).

import 'server-only';
import { redirect } from '@/i18n/routing';
import { loadTool } from './access';
import { getSenales } from './registry';

export async function requireSenalesReady(locale: string, path: string) {
  const gate = await loadTool(locale, 'chalybcrypto', path, getSenales);
  if (gate.kind !== 'ready' || gate.riskPending) return redirect({ href: '/app/senales', locale });
  return gate;
}
