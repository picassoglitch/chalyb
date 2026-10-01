// Gate for every tool screen (P3): signed in, the tool included in the plan,
// the hub running it (otherwise its launch page), and — for Señales,
// Pronósticos and Inversiones — whether the risk notice still has to show.

import 'server-only';
import { redirect } from '@/i18n/routing';
import { getSessionUser, type SessionUser } from '@/lib/auth/session';
import { getEntitlements, type Entitlements } from '@/lib/billing/entitlement';
import { hasRiskAck } from './consents';
import { hubRunsTool } from './registry';

export async function requireTool<A>(
  locale: string,
  slug: string,
  path: string,
  adapter: () => A | null,
): Promise<{ session: SessionUser; entitlements: Entitlements; adapter: A; riskPending: boolean }> {
  const session = await getSessionUser();
  if (!session) return redirect({ href: `/sign-in?next=${encodeURIComponent(path)}`, locale });
  const entitlements = await getEntitlements(session);
  const access = entitlements.tools[slug];
  if (!access) return redirect({ href: '/app/herramientas', locale });
  if (access.state !== 'included') return redirect({ href: `/app/engines/${slug}`, locale });
  const a = hubRunsTool(slug) ? adapter() : null;
  if (!a) return redirect({ href: `/app/engines/${slug}`, locale });
  return { session, entitlements, adapter: a, riskPending: !(await hasRiskAck(session.user.id, slug)) };
}

export const planKeyFor = (plan: string): 'FREE' | 'PRO' | 'VIP' =>
  plan === 'VIP' ? 'VIP' : plan === 'FREE' ? 'FREE' : 'PRO';
