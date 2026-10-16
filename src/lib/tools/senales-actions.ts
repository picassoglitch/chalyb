'use server';

// Señales · paso 2 → listo. Saves DELIVERY preferences only (coins as a
// filter, channels, timeframe). No balance, position or risk profile.

import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { getEntitlements } from '@/lib/billing/entitlement';
import { getSenales, hubRunsTool } from './registry';
import { hasRiskAck } from './consents';
import { runTool } from './bff';
import type { SignalChannel } from './adapters/tools';

export async function saveSignalPrefs(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const session = await getSessionUser();
  if (!session) return redirect({ href: '/sign-in?next=/app/senales', locale });
  const ent = await getEntitlements(session);
  const adapter = hubRunsTool('chalybcrypto') ? getSenales() : null;
  if (ent.tools.chalybcrypto?.state !== 'included' || !adapter)
    return redirect({ href: '/app/senales', locale });
  if (!(await hasRiskAck(session.user.id, 'chalybcrypto')))
    return redirect({ href: '/app/senales', locale });

  const known = new Set((await adapter.coins()).map((c) => c.symbol));
  const coins = String(formData.get('coins') ?? '')
    .split(',')
    .filter((c) => known.has(c));
  const supported = new Set(await adapter.channels());
  const channels = formData
    .getAll('channel')
    .map(String)
    .filter((c): c is SignalChannel => supported.has(c as SignalChannel));
  if (!coins.length) return redirect({ href: '/app/senales/empezar', locale });
  if (!channels.length)
    return redirect({
      href: `/app/senales/empezar/avisos?coins=${coins.join(',')}&error=channels`,
      locale,
    });
  const prefs = {
    coins,
    channels,
    timeframe: formData.get('timeframe') === 'week' ? ('week' as const) : ('day' as const),
    quietHours: formData.get('quiet') === 'on',
  };
  // Mode "a" saves in the engine: through the BFF, and a failure lands on
  // /app/senales, which shows the tool's error state.
  const saved = await runTool('chalybcrypto', session.user.id, (signal) =>
    adapter.savePrefs(session.user.id, prefs, signal),
  );
  if (!saved.ok) return redirect({ href: '/app/senales', locale });
  return redirect({ href: '/app/senales/empezar/listo', locale });
}
