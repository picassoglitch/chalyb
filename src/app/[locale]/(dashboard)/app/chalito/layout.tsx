import type { ReactNode } from 'react';
import { ToolShell } from '@/components/tools/tool-shell';
import { ChalitoProvider } from '@/lib/chalito/provider';
import { HubBridge } from '@/components/tools/chalito/HubBridge';
import { ChalitoNav } from '@/components/tools/chalito/ChalitoNav';

// Chalito inside the app (owner decision 2026-10-05): the hub's tool shell, Chalito's provider
// (this browser's device keys and session), and the hub→Chalito sign-in bridge.
export default function ChalitoLayout({ children }: { children: ReactNode }) {
  return (
    <ToolShell slug="chalito" tab={null}>
      <ChalitoProvider>
        <HubBridge>
          <ChalitoNav />
          {children}
        </HubBridge>
      </ChalitoProvider>
    </ToolShell>
  );
}
