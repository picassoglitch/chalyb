// The real status line on each card of Tus herramientas (TOOLS-SPEC §7.2).
// The pure part decides the message key; the server part reads each tool
// through the BFF and simply leaves the line out when the tool can't answer
// (the card never shows an error or a made-up number).

import 'server-only';
import type { PlanTierKey } from './adapters/tools';
import { getClipsAdapter } from './adapters/clips';
import { getEnVivo, getSenales, hubRunsTool } from './registry';
import { runTool } from './bff';
import { withoutHiddenJobs } from '@/lib/legal/removals';
import { clipsLine, liveLine, signalsLine, type ToolStatusLine } from './status-lines-core';

export type { ToolStatusLine } from './status-lines-core';

export async function toolStatusLines(
  userId: string,
  plan: PlanTierKey,
  includedSlugs: string[],
  locale: string,
  now = new Date(),
): Promise<Record<string, ToolStatusLine | null>> {
  const out: Record<string, ToolStatusLine | null> = {};
  const tz = 'America/Mexico_City';
  await Promise.all(
    includedSlugs.map(async (slug) => {
      // Only tools the hub runs itself have a line. Mode A is a stub that
      // throws NOT_IMPLEMENTED (registry.ts): calling it would log a tool
      // error, trip the breaker and mark the tool down on every page view.
      if (!hubRunsTool(slug)) return;
      if (slug === 'chalybclip') {
        const a = getClipsAdapter();
        if (!a) return;
        const r = await runTool(slug, userId, (signal) => a.listJobs(userId, 50, signal), {
          idempotent: true,
        });
        if (!r.ok) return;
        const jobs = await withoutHiddenJobs(userId, r.data, (j) => j.id);
        const working = jobs.filter((j) => j.state !== 'ready' && j.state !== 'failed');
        const ready = jobs.filter((j) => j.state === 'ready');
        out[slug] = clipsLine(
          {
            inProgress: working.length,
            ready: ready.reduce((n, j) => n + j.clips.length, 0),
            latestReadyAt: ready[0]?.createdAt ?? null,
          },
          now,
          locale,
          tz,
        );
      }
      if (slug === 'chalybcrypto') {
        const a = getSenales();
        if (!a) return;
        const r = await runTool(slug, userId, (signal) => a.getSignals({ plan }, signal), {
          idempotent: true,
        });
        if (!r.ok) return;
        out[slug] = signalsLine(
          r.data.map((s) => s.at),
          now,
          tz,
        );
      }
      if (slug === 'chalybobs') {
        const a = getEnVivo();
        if (!a) return;
        const r = await runTool(slug, userId, (signal) => a.status(userId, signal), {
          idempotent: true,
        });
        if (!r.ok) return;
        out[slug] = liveLine({ connected: r.data.obsConnected, live: r.data.liveSince !== null });
      }
    }),
  );
  return out;
}
