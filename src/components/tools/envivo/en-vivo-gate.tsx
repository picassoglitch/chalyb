// The gate every En vivo screen shares: locked / setup / tool error render
// inside ToolShell; otherwise the screen gets the session and the adapter.

import type { ReactNode } from 'react';
import { loadTool } from '@/lib/tools/access';
import { getEnVivo } from '@/lib/tools/registry';
import type { EnVivoAdapter } from '@/lib/tools/adapters/tools';
import type { SessionUser } from '@/lib/auth/session';
import type { Entitlements } from '@/lib/billing/entitlement';
import type { ToolTabKey } from '@/config/tools';
import type { ToolError } from '@/lib/tools/bff-core';
import { SetupState } from '@/components/ui/setup-state';
import { ToolShell } from '@/components/tools/tool-shell';
import { ToolErrorState } from '@/components/tools/tool-error-state';
import { ToolLockedState, lockedOffer } from '@/components/tools/tool-locked-state';
import '@/styles/tools-envivo.css';

export const SLUG = 'chalybobs';

export type EnVivoReady = {
  session: SessionUser;
  entitlements: Entitlements;
  adapter: EnVivoAdapter;
};

export async function enVivoGate(
  locale: string,
  path: string,
  tab: ToolTabKey,
): Promise<{ fallback: ReactNode } | { ready: EnVivoReady }> {
  const gate = await loadTool(locale, SLUG, path, getEnVivo);
  if (gate.kind === 'locked')
    return {
      fallback: (
        <ToolShell
          slug={SLUG}
          tab={null}
          plan={lockedOffer(gate.entitlements).trial ? 'offer' : 'pro'}
        >
          <ToolLockedState slug={SLUG} entitlements={gate.entitlements} />
        </ToolShell>
      ),
    };
  if (gate.kind === 'error') return { fallback: <EnVivoError tab={tab} error={gate.error} /> };
  if (gate.kind === 'setup') {
    // OBS missing is En vivo's own first step: the screen shows Conectar (57)
    // when the tool has no paired computer. Any other step is named.
    const adapter = getEnVivo();
    if (gate.step === 'obs' && adapter)
      return { ready: { session: gate.session, entitlements: gate.entitlements, adapter } };
    return {
      fallback: (
        <ToolShell slug={SLUG} tab={tab}>
          <SetupState step={gate.step} />
        </ToolShell>
      ),
    };
  }
  return {
    ready: { session: gate.session, entitlements: gate.entitlements, adapter: gate.adapter },
  };
}

export function EnVivoError({ tab, error }: { tab: ToolTabKey; error: ToolError }) {
  return (
    <ToolShell slug={SLUG} tab={tab}>
      <ToolErrorState slug={SLUG} error={error} />
    </ToolShell>
  );
}
