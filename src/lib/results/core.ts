// Mis resultados (SCR-19, P3-13): one list of what the tools made, from each tool's
// adapter. Pure: the filtering and progress logic the page and tests share.

import type { ClipJob, ClipJobState } from '@/lib/tools/adapters/types';
import type { PropertyCard } from '@/lib/tools/adapters/tools';

export type ResultItem =
  | {
      kind: 'clips';
      id: string;
      slug: 'chalybclip';
      state: 'ready' | 'working' | 'failed';
      count: number;
      pct: number;
      source: string;
      href: string;
      at: string;
    }
  | {
      kind: 'property';
      id: string;
      slug: 'chalybrealtor';
      state: 'ready';
      title: string;
      photo: string | null;
      shareUrl: string;
      at: string;
    };

const PCT: Record<ClipJobState, number> = {
  received: 10,
  finding_moments: 40,
  adding_captions: 75,
  ready: 100,
  failed: 0,
};

export function clipItem(job: ClipJob): ResultItem {
  return {
    kind: 'clips',
    id: job.id,
    slug: 'chalybclip',
    state: job.state === 'ready' ? 'ready' : job.state === 'failed' ? 'failed' : 'working',
    count: job.state === 'ready' ? job.clips.length : job.count,
    pct: PCT[job.state],
    source: job.sourceUrl,
    href: `/app/clips/trabajo/${encodeURIComponent(job.id)}`,
    at: job.createdAt,
  };
}

export function propertyItem(card: PropertyCard): ResultItem {
  return {
    kind: 'property',
    id: card.id,
    slug: 'chalybrealtor',
    state: 'ready',
    title: card.title,
    photo: card.photos[0] ?? null,
    shareUrl: card.shareUrl,
    at: card.createdAt,
  };
}

/** Newest first. */
export function mergeResults(...lists: ResultItem[][]): ResultItem[] {
  return lists.flat().sort((a, b) => b.at.localeCompare(a.at));
}

export type ResultChip = 'all' | 'ready' | string; // a tool slug

/** Chips: Todos, Listos, then one per tool that has results (only tools
 *  with results, so a hidden tool never gets a chip). */
export function chipsFor(items: ResultItem[]): ResultChip[] {
  return ['all', 'ready', ...new Set(items.map((i) => i.slug))];
}

function haystack(i: ResultItem): string {
  return (i.kind === 'clips' ? `${i.source} clips ${i.count}` : `${i.title}`).toLowerCase();
}

export function filterResults(items: ResultItem[], chip: ResultChip, query: string): ResultItem[] {
  const q = query.trim().toLowerCase();
  return items.filter(
    (i) =>
      (chip === 'all' || (chip === 'ready' ? i.state === 'ready' : i.slug === chip)) &&
      (!q || haystack(i).includes(q)),
  );
}
