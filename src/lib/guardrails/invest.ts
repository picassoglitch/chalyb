// Inversiones: the user's own rules on the user's own exchange, never our
// custody (BUILD-SPEC §7.4, §11.4; REVISION-LEGAL C1). Pure.

import type { AutomationRule, KeyPermissions } from '@/lib/tools/adapters/tools';

export type KeyDecision = { ok: true } | { ok: false; reason: 'withdraw' | 'no_read' };

/** A key with withdrawal permission is refused, always. */
export function decideKey(p: KeyPermissions): KeyDecision {
  if (p.withdraw) return { ok: false, reason: 'withdraw' };
  if (!p.read) return { ok: false, reason: 'no_read' };
  return { ok: true };
}

export interface RuleDraft {
  source?: unknown;
  asset?: unknown;
  side?: unknown;
  condition?: unknown;
  maxAmount?: unknown;
  schedule?: unknown;
}

export type RuleCheck =
  | { ok: true; rule: Omit<AutomationRule, 'id' | 'active' | 'createdAt'> }
  | { ok: false; errors: ('source' | 'asset' | 'side' | 'condition' | 'maxAmount' | 'schedule')[] };

/** Only a rule the user wrote is valid: no source but 'user', no empty
 *  condition, a positive maximum the user typed. */
export function validateRule(d: RuleDraft): RuleCheck {
  const errors: Exclude<RuleCheck, { ok: true }>['errors'] = [];
  if (d.source !== undefined && d.source !== 'user') errors.push('source');
  const asset = typeof d.asset === 'string' ? d.asset.trim().toUpperCase() : '';
  if (!/^[A-Z0-9]{2,10}$/.test(asset)) errors.push('asset');
  if (d.side !== 'buy' && d.side !== 'sell') errors.push('side');
  const condition = typeof d.condition === 'string' ? d.condition.trim() : '';
  if (condition.length < 4 || condition.length > 280) errors.push('condition');
  const max = typeof d.maxAmount === 'number' ? d.maxAmount : Number(d.maxAmount);
  if (!Number.isFinite(max) || max <= 0) errors.push('maxAmount');
  const schedule = typeof d.schedule === 'string' ? d.schedule.trim() : '';
  if (!schedule) errors.push('schedule');
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    rule: {
      source: 'user',
      asset,
      side: d.side as 'buy' | 'sell',
      condition,
      maxAmount: max,
      schedule,
    },
  };
}

export const INVEST_FORBIDDEN = [
  /copiar se[ñn]al/i,
  /seguir a chalyb/i,
  /portafolio modelo/i,
  /cartera modelo/i,
];
