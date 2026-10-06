import type { ReactNode } from 'react';
import { ToolShell } from '@/components/tools/tool-shell';
import { ChalitoProvider } from '@/lib/chalito/provider';
import { HubBridge } from '@/components/tools/chalito/HubBridge';
import { ChalitoNav } from '@/components/tools/chalito/ChalitoNav';
import { UiBridge } from '@/components/tools/chalito/UiBridge';
import { TestModeBanner } from '@/components/tools/chalito/TestModeBanner';
import { DevModeBanner } from '@/components/tools/chalito/DevModeBanner';
import { StepUpHost } from '@/components/tools/chalito/StepUpHost';
import { Companion } from '@/components/tools/chalito/Companion';

// Chalito inside the app (owner decision 2026-10-05): the hub's tool shell, Chalito's provider
// (this browser's device keys and session), and the hub→Chalito sign-in bridge. UiBridge hands
// next-intl to @chalito/ui; StepUpHost is the HIGH/CRITICAL approval confirm dialog. Companion is
// the picked character on every screen, outside HubBridge so it's there while signing in too.
export default function ChalitoLayout({ children }: { children: ReactNode }) {
  return (
    <ToolShell slug="chalito" tab={null}>
      <UiBridge>
        <ChalitoProvider>
          <TestModeBanner />
          <DevModeBanner />
          <HubBridge>
            <ChalitoNav />
            {children}
          </HubBridge>
          <StepUpHost />
          <Companion />
        </ChalitoProvider>
      </UiBridge>
    </ToolShell>
  );
}
