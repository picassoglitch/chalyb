// Actividad (P5-4): one chronological list from every log the hub keeps.
// Pure: the readers normalise rows into ActivityEvent; this merges, sorts
// and filters. No IP or user agent ever reaches it.

export type ActivityType =
  | 'charge'
  | 'failed'
  | 'refund'
  | 'cancel'
  | 'notice'
  | 'consent'
  | 'admin'
  | 'tool';

export interface ActivityEvent {
  id: string;
  at: string;
  type: ActivityType;
  tool: string | null;
  title: string;
  detail: string | null;
  who: string | null;
}

export function mergeActivity(
  sources: readonly (readonly ActivityEvent[])[],
  filter: { type?: string | null; tool?: string | null } = {},
  limit = 200,
): ActivityEvent[] {
  const seen = new Set<string>();
  return sources
    .flat()
    .filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return (!filter.type || e.type === filter.type) && (!filter.tool || e.tool === filter.tool);
    })
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}
