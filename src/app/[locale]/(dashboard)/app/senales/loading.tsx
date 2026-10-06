// Señales loading (TOOLS-SPEC §5.2): skeletons for 3 cards; the legal strip
// paints right away.

import { Skeleton } from '@/components/ui/primitives';
import { ToolShell } from '@/components/tools/tool-shell';
import { SignalsDisclaimer } from '@/components/tools/senales/common';
import '@/styles/tools-senales.css';

export default function SenalesLoading() {
  return (
    <ToolShell slug="chalybcrypto" tab="main">
      <div className="ch-sig-skel" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={150} />
        ))}
      </div>
      <SignalsDisclaimer />
    </ToolShell>
  );
}
