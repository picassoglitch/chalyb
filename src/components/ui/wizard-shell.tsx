// Three-step wizard frame (BUILD-SPEC §0.7, §5.5): no navigation; Atrás on
// the left, the tool in the middle, close (✕) on the right, and "Paso N de 3"
// underneath. Closing goes back to Inicio.

import type { Route } from 'next';
import type { ReactNode } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { StepBar } from './primitives';
import { TOOL_ICONS } from './tool-icon';

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
        <Link href={backHref as Route} className="ch-back" aria-label={backLabel}>
          <ChevronLeft aria-hidden="true" />
          <span>{backLabel}</span>
        </Link>
        <div className="ch-toptitle">
          {Icon && (
            <span className="ch-toptitle__mark" aria-hidden="true">
              <Icon />
            </span>
          )}
          {toolName}
        </div>
        <Link href={'/app' as Route} className="ch-close" aria-label={closeLabel}>
          <X aria-hidden="true" />
        </Link>
      </header>
      {step && stepLabel && <StepBar step={step} label={stepLabel} />}
      <main id="main" className={`ch-col${narrow ? ' ch-col--narrow' : ''}`}>
        {children}
      </main>
    </div>
  );
}
