'use server';

// Señales · paso 2 → listo. Saves DELIVERY preferences only (coins as a
// filter, channels, timeframe). No balance, position or risk profile.

import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { getEntitlements } from '@/lib/billing/entitlement';
import { getSenales, hubRunsTool } from './registry';
import { hasRiskAck } from './consents';
import type { SignalChannel } from './adapters/tools';

export async function saveSignalPrefs(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const session = await getSessionUser();
  if (!session) return redirect({ href: '/sign-in?next=/app/senales', locale });
  const ent = await getEntitlements(session);
  const adapter = hubRunsTool('chalybcrypto') ? getSenales() : null;
  if (ent.tools.chalybcrypto?.state !== 'included' || !adapter) return redirect({ href: '/app/senales', locale });
  if (!(await hasRiskAck(session.user.id, 'chalybcrypto'))) return redirect({ href: '/app/senales', locale });

  const known = new Set((await adapter.coins()).map((c) => c.symbol));
  const coins = String(formData.get('coins') ?? '').split(',').filter((c) => known.has(c));
  const supported = new Set(await adapter.channels());
  const channels = formData.getAll('channel').map(String).filter((c): c is SignalChannel => supported.has(c as SignalChannel));
  if (!coins.length) return redirect({ href: '/app/senales', locale });
  if (!channels.length) return redirect({ href: `/app/senales/avisos?coins=${coins.join(',')}&error=channels`, locale });
  await adapter.savePrefs(session.user.id, {
    coins,
    channels,
    timeframe: formData.get('timeframe') === 'week' ? 'week' : 'day',
    quietHours: formData.get('quiet') === 'on',
  });
  return redirect({ href: '/app/senales/listo', locale });
}
