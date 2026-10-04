// "Necesita tu atención" (P5-1). Pure: counts in, items out. An item with
// nothing pending is not shown; every shown item links to where it's handled.

export interface AttentionCounts {
  failedCharges: number;
  refundRequests: number;
  slowTools: number;
  newIdeas: number;
  bouncedNotices: number;
  chargesWithoutNotice: number;
  /** ARCO requests whose legal answer date is within 5 days or past
   *  (Aviso de privacidad §5.3). Optional: older callers count 0. */
  arcoDue?: number;
  /** Copyright notices waiting for a removal or a counter-notice step. */
  takedownsOpen?: number;
}

export type AttentionKey = keyof AttentionCounts;

const TARGETS: Record<AttentionKey, string> = {
  failedCharges: '/dashboard/dinero?estado=failed',
  refundRequests: '/dashboard/messages',
  slowTools: '/dashboard/actividad?tipo=tool',
  newIdeas: '/dashboard/messages',
  bouncedNotices: '/dashboard/actividad?tipo=notice',
  chargesWithoutNotice: '/dashboard/dinero',
  arcoDue: '/dashboard/legal',
  takedownsOpen: '/dashboard/legal',
};

export function attentionItems(
  c: AttentionCounts,
): { key: AttentionKey; n: number; href: string }[] {
  return (Object.keys(TARGETS) as AttentionKey[])
    .filter((k) => (c[k] ?? 0) > 0)
    .map((k) => ({ key: k, n: c[k] ?? 0, href: TARGETS[k] }));
}

export type ToolHealth = 'ok' | 'slow' | 'down';

/** Failures in 24 h from which a tool reads "Lento hoy". */
export const SLOW_FAILURES_24H = 3;

/**
 * From real signals only: the engine's reported state (engine_health; null
 * when it never reported) and the hub's own failure log.
 */
export function toolHealth(input: { engineState: string | null; failures24h: number }): ToolHealth {
  if (input.engineState === 'ERROR' || input.engineState === 'OFFLINE') return 'down';
  if (input.engineState === 'DELAYED' || input.failures24h >= SLOW_FAILURES_24H) return 'slow';
  return 'ok';
}
