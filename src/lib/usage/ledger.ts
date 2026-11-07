// The Movimientos list on /app/usage: usage events folded into one row per
// use. Pure, unit-tested.

export interface UsageEventRow {
  id: string;
  engine_id: string;
  kind: string;
  amount: number;
  occurred_at: string;
  operation: string | null;
  /** What the event drew from the balance (margin included, frozen at
   *  insert — migration 0046). Absent only on the legacy query. */
  billable_tokens?: number | null;
}

export interface Use {
  key: string;
  engineId: string;
  at: string;
  credits: number;
  operation: string;
}

/** Credits an event took from the balance. Every meter counts (compute,
 *  transcription, base fee), not only LLM tokens, same as the balance. */
export function eventCredits(e: UsageEventRow): number {
  const billed = Number(e.billable_tokens);
  if (e.billable_tokens !== null && e.billable_tokens !== undefined && Number.isFinite(billed))
    return billed;
  return e.kind === 'llm.tokens' ? e.amount : 0;
}

/** Events sharing tool, operation and day are one use. */
export function groupUses(events: UsageEventRow[]): Map<string, Use> {
  const uses = new Map<string, Use>();
  for (const e of events) {
    const key = e.operation
      ? `${e.engine_id}|${e.operation}|${(e.occurred_at || '').slice(0, 10)}`
      : e.id;
    const credits = eventCredits(e);
    const u = uses.get(key);
    if (u) {
      u.credits += credits;
      if (e.occurred_at > u.at) u.at = e.occurred_at;
    } else
      uses.set(key, {
        key,
        engineId: e.engine_id,
        at: e.occurred_at,
        credits,
        operation: e.operation ?? e.kind,
      });
  }
  return uses;
}
