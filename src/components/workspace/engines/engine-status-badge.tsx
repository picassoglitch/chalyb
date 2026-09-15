'use client';

// The one status vocabulary for engine tiles across /app (home kit strip,
// engines list, detail header). Labels come from readiness.ts states so a
// card can never say "En vivo" about an engine the user cannot open.

import type { EngineDisplayState } from '@/lib/billing/readiness';

const STYLE: Record<EngineDisplayState, { label: string; cls: string; dot?: boolean }> = {
  live: { label: 'En vivo', cls: 'gr', dot: true },
  trial: { label: 'Prueba en vivo', cls: 'cy', dot: true },
  ready: { label: 'Listo · activa en vivo', cls: 'gr' },
  simulation: { label: 'Simulación', cls: 'cy' },
  locked: { label: 'Requiere Pro', cls: 'pu' },
  coming_soon: { label: 'Próximamente', cls: '' },
};

export function engineStateLabel(
  state: EngineDisplayState,
  extra?: { trialDaysLeft?: number; lockedPlan?: string },
): string {
  if (state === 'trial' && extra?.trialDaysLeft) return `Prueba ${extra.trialDaysLeft}d`;
  if (state === 'locked' && extra?.lockedPlan) return `Requiere ${extra.lockedPlan}`;
  return STYLE[state].label;
}

export function EngineStatusBadge({
  state,
  trialDaysLeft,
  lockedPlan,
  size = 'sm',
}: {
  state: EngineDisplayState;
  trialDaysLeft?: number;
  lockedPlan?: string;
  size?: 'sm' | 'md';
}) {
  const s = STYLE[state];
  return (
    <span
      className={`cc-mod-badge ${s.cls}`}
      style={size === 'md' ? { padding: '6px 12px', fontSize: 11 } : undefined}
    >
      {s.dot ? '● ' : ''}
      {engineStateLabel(state, { trialDaysLeft, lockedPlan })}
    </span>
  );
}
