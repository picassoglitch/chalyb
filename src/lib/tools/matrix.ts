// Más herramientas (SCR-23, P3-7): what each tool card offers, from its
// entitlement state alone. Pure. Never a lock, never "Disponible".

import type { ToolAccess } from '@/lib/billing/entitlement-core';

export type ToolCardAction =
  | { pill: 'included'; button: 'open' }
  | { pill: 'inPro'; button: 'try' | 'return' | 'plans'; href: '/app/prueba' | '/app/planes' }
  | { pill: 'setup'; button: 'connect' };

export function toolCardAction(
  state: ToolAccess['state'],
  ctx: { plan: string; trialUsed: boolean; trialFlow: boolean; proIncludesAllTools: boolean },
): ToolCardAction {
  if (state === 'included') return { pill: 'included', button: 'open' };
  if (state === 'setup_needed') return { pill: 'setup', button: 'connect' };
  const offer = ctx.plan === 'FREE' && ctx.trialFlow && ctx.proIncludesAllTools;
  if (!offer) return { pill: 'inPro', button: 'plans', href: '/app/planes' };
  return { pill: 'inPro', button: ctx.trialUsed ? 'return' : 'try', href: '/app/prueba' };
}
