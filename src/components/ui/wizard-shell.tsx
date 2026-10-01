// Three-step wizard frame (BUILD-SPEC §0.7, §5.5): no navigation; Atrás on
// the left, the tool in the middle, close (✕) on the right, and "Paso N de 3"
// underneath. Closing goes back to Inicio, asking first if something was
// typed (P3-1).

import type { ReactNode } from 'react';
import { StepBar } from './primitives';
import { TOOL_ICONS } from './tool-icon';
import { WizardClose } from './wizard-close';
import { WizardBack } from './wizard-back';

export function WizardShell({
  slug,
  toolName,
  step,
  stepLabel,
  backHref,
  backLabel,
  closeLabel,
  narrow,
  children,
}: {
  slug: string;
  toolName: string;
  /** Omit on screens after the 3 steps (Listos, errors). */
  step?: 1 | 2 | 3;
  stepLabel?: string;
  backHref: string;
  backLabel: string;
  closeLabel: string;
  narrow?: boolean;
  children: ReactNode;
}) {
  const Icon = TOOL_ICONS[slug];
  return (
    <div className="ch-flow">
      <header className="ch-topbar">
        <WizardBack href={backHref} label={backLabel} />
        <div className="ch-toptitle">
          {Icon && (
            <span className="ch-toptitle__mark" aria-hidden="true">
              <Icon />
            </span>
          )}
          {toolName}
        </div>
        <WizardClose label={closeLabel} />
      </header>
      {step && stepLabel && <StepBar step={step} label={stepLabel} />}
      <main id="main" className={`ch-col${narrow ? ' ch-col--narrow' : ''}`}>
        {children}
      </main>
    </div>
  );
}
