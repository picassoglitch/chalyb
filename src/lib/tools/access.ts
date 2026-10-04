// Gate for every tool screen. Nothing here sends the person out of the app
// or to the old launch page (TOOLS-SPEC §0.1, F1–F3):
//
//   not signed in        → sign-in, back here after
//   tool not visible     → Tus herramientas
//   trial_offer          → the screen renders ToolLockedState
//   setup_needed         → the screen renders SetupState for the named step
//   no adapter (engine has no API yet, TOOL_HUB_MODE_<SLUG>=off)
//                        → a risk tool with its notice pending renders the
//                          risk sheet first (kind 'risk'; the launch refuses
//                          without it, aceptacion-ux §6); otherwise
//                          hand off to the engine's app over SSO
//                          (/auth/launch/<slug>?via=hub), as before the
//                          rebuild, until the engine's job API exists (OPS-13)
//   included + adapter   → the screen; riskPending opens the risk sheet

import 'server-only';
import { redirect as redirectPath } from 'next/navigation';
import { redirect } from '@/i18n/routing';
import { getSessionUser, type SessionUser } from '@/lib/auth/session';
import { getEntitlements, type Entitlements } from '@/lib/billing/entitlement';
import type { SetupStep } from '@/lib/billing/entitlement-core';
import { hasRiskAck } from './consents';
import { hubRunsTool } from './registry';
import { reportToolError } from './bff';
import type { ToolError } from './bff-core';

export type ToolGate<A> =
  | { kind: 'locked'; session: SessionUser; entitlements: Entitlements }
  | { kind: 'setup'; session: SessionUser; entitlements: Entitlements; step: SetupStep }
  | { kind: 'error'; session: SessionUser; entitlements: Entitlements; error: ToolError }
  | { kind: 'risk'; session: SessionUser; entitlements: Entitlements }
  | {
      kind: 'ready';
      session: SessionUser;
      entitlements: Entitlements;
      adapter: A;
      riskPending: boolean;
    };

export async function loadTool<A>(
  locale: string,
  slug: string,
  path: string,
  adapter: () => A | null,
): Promise<ToolGate<A>> {
  const session = await getSessionUser();
  if (!session) return redirect({ href: `/sign-in?next=${encodeURIComponent(path)}`, locale });
  const entitlements = await getEntitlements(session);
  const access = entitlements.tools[slug];
  if (!access) return redirect({ href: '/app/herramientas', locale });
  if (access.state === 'trial_offer') return { kind: 'locked', session, entitlements };
  if (access.state === 'setup_needed')
    return { kind: 'setup', session, entitlements, step: access.missing };
  // Without an in-hub adapter the engine's own app is the only way in. A failed
  // launch with via=hub lands on Tus herramientas, never back here (no loop).
  // The launch refuses a risk tool whose notice isn't accepted, so the sheet
  // has to open here first; accepting it refreshes this screen into the hand-off.
  if (!hubRunsTool(slug)) {
    if (!(await hasRiskAck(session.user.id, slug))) return { kind: 'risk', session, entitlements };
    redirectPath(`/auth/launch/${slug}?via=hub`);
  }
  const a = adapter();
  if (!a)
    return {
      kind: 'error',
      session,
      entitlements,
      error: await reportToolError(slug, session.user.id, 'unavailable', true),
    };
  return {
    kind: 'ready',
    session,
    entitlements,
    adapter: a,
    riskPending: !(await hasRiskAck(session.user.id, slug)),
  };
}

/** For the tools outside the registry (Asistente, Pronósticos, Inmuebles,
 *  Inversiones; `live: false`): their wizard, or Tus herramientas. */
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
  if (!access || access.state !== 'included')
    return redirect({ href: '/app/herramientas', locale });
  const a = hubRunsTool(slug) ? adapter() : null;
  if (!a) return redirect({ href: '/app/herramientas', locale });
  return {
    session,
    entitlements,
    adapter: a,
    riskPending: !(await hasRiskAck(session.user.id, slug)),
  };
}

export const planKeyFor = (plan: string): 'FREE' | 'PRO' | 'VIP' =>
  plan === 'VIP' ? 'VIP' : plan === 'FREE' ? 'FREE' : 'PRO';
