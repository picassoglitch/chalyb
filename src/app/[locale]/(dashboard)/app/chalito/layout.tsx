import type { ReactNode } from 'react';
import { ToolShell } from '@/components/tools/tool-shell';
import { ChalitoProvider } from '@/lib/chalito/provider';
import { HubBridge } from '@/components/tools/chalito/HubBridge';
import { UiBridge } from '@/components/tools/chalito/UiBridge';
import { TestModeBanner } from '@/components/tools/chalito/TestModeBanner';
import { DevModeBanner } from '@/components/tools/chalito/DevModeBanner';
import { StepUpHost } from '@/components/tools/chalito/StepUpHost';
import { Companion } from '@/components/tools/chalito/Companion';
import { ApprovalPopup } from '@/components/tools/chalito/Coordinator';
import '@/styles/tools-chalito.css';
import { getCurrentUser, getSessionUser } from '@/lib/auth/session';
import { getEntitlements } from '@/lib/billing/entitlement';
import { ToolLockedState, lockedOffer } from '@/components/tools/tool-locked-state';
import { chalitoGate } from '@/lib/chalito/web/plan-gate';

// Chalito inside the app (owner decision 2026-10-05): the hub's tool shell (its 3 tabs; the other
// sections are rows on Chalito's Inicio, owner decision 2026-10-06), Chalito's provider
// (this browser's device keys and session), and the hub→Chalito sign-in bridge. UiBridge hands
// next-intl to @chalito/ui; StepUpHost is the HIGH/CRITICAL approval confirm dialog; ApprovalPopup
// shows the newest pending approval on every screen (coordinator mode, ADR 0025 §6). Companion is
// the picked character on every screen, outside HubBridge so it's there while signing in too.
// hubUserId: Chalito's own browser session must belong to the person signed in to the hub.
// Chalito is Pro and VIP only (owner decision 2026-10-16): a plan without it gets the shared
// "viene en Pro" state, not a sign-in that ends in a 403.
export default async function ChalitoLayout({ children }: { children: ReactNode }) {
  const [user, session] = await Promise.all([getCurrentUser(), getSessionUser()]);
  const entitlements = session ? await getEntitlements(session) : null;
  if (entitlements && chalitoGate(entitlements.tools) === 'locked')
    return (
      <ToolShell slug="chalito" tab={null} plan={lockedOffer(entitlements).trial ? 'offer' : 'pro'}>
        <ToolLockedState slug="chalito" entitlements={entitlements} />
      </ToolShell>
    );
  return (
    <ToolShell slug="chalito" tab="auto">
      <UiBridge>
        <ChalitoProvider hubUserId={user?.id}>
          <TestModeBanner />
          <DevModeBanner />
          <HubBridge>
            {children}
            <ApprovalPopup />
          </HubBridge>
          <StepUpHost />
          <Companion />
        </ChalitoProvider>
      </UiBridge>
    </ToolShell>
  );
}
