// What a Clips engine screen shows when it can't render (mode "a"): the plan
// lock, the missing setup step, or the tool error state — inside ToolShell,
// tabs kept. Same states as Clips' home.

import type { ToolTabKey } from '@/config/tools';
import type { ToolError } from '@/lib/tools/bff-core';
import type { ClipsEngineGate } from '@/lib/tools/clips-engine';
import { ToolShell } from '@/components/tools/tool-shell';
import { ToolErrorState } from '@/components/tools/tool-error-state';
import { ToolLockedState, lockedOffer } from '@/components/tools/tool-locked-state';
import { SetupState } from '@/components/ui/setup-state';
import '@/styles/tools-clips.css';
import '@/styles/tools-clips-engine.css';

export function ClipsGateView({
  gate,
  tab,
}: {
  gate: Exclude<ClipsEngineGate, { kind: 'ready' }>;
  tab: ToolTabKey;
}) {
  if (gate.kind === 'locked')
    return (
      <ToolShell
        slug="chalybclip"
        tab={null}
        plan={lockedOffer(gate.entitlements).trial ? 'offer' : 'pro'}
      >
        <ToolLockedState slug="chalybclip" entitlements={gate.entitlements} />
      </ToolShell>
    );
  return (
    <ToolShell slug="chalybclip" tab={tab}>
      {gate.kind === 'error' && <ToolErrorState slug="chalybclip" error={gate.error} />}
      {gate.kind === 'setup' && <SetupState step={gate.step} alternativeHref="/app/clips/nuevo" />}
    </ToolShell>
  );
}

/** A failed engine read on a page that otherwise loaded. */
export function ClipsReadError({ error, tab }: { error: ToolError; tab: ToolTabKey }) {
  return (
    <ToolShell slug="chalybclip" tab={tab}>
      <ToolErrorState slug="chalybclip" error={error} savedWork />
    </ToolShell>
  );
}
