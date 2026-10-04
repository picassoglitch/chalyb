// Reads each tool's results for the signed-in user. A tool that fails to
// answer is left out (logged), never the whole page.

import 'server-only';
import type { Entitlements } from '@/lib/billing/entitlement-core';
import { getClipsAdapter } from '@/lib/tools/adapters/clips';
import { getInmuebles, hubRunsTool } from '@/lib/tools/registry';
import { clipItem, mergeResults, propertyItem, type ResultItem } from './core';
import { hiddenJobIds } from '@/lib/legal/removals';

async function safe<T>(label: string, fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[results] ${label} unavailable`, e instanceof Error ? e.message : e);
    return [];
  }
}

export async function collectResults(
  userId: string,
  ent: Entitlements,
  limit = 50,
): Promise<ResultItem[]> {
  const clips = getClipsAdapter();
  const homes =
    hubRunsTool('chalybrealtor') && ent.tools.chalybrealtor?.state === 'included'
      ? getInmuebles()
      : null;
  const [jobs, cards, hidden] = await Promise.all([
    clips ? safe('clips', () => clips.listJobs(userId, limit)) : Promise.resolve([]),
    homes ? safe('inmuebles', () => homes.list(userId)) : Promise.resolve([]),
    hiddenJobIds(userId),
  ]);
  // Jobs removed after a copyright notice never show (Uso aceptable §5.2).
  const visible = jobs.filter((j) => !hidden.has(j.id));
  return mergeResults(visible.map(clipItem), cards.map(propertyItem)).slice(0, limit);
}
