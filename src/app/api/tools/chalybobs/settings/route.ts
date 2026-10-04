// GET / PATCH /api/tools/chalybobs/settings — Ajustes de En vivo (§6.3).
// The stream key is NOT part of settings: only stream-key returns it.

import { getEnVivo } from '@/lib/tools/registry';
import { toolRoute } from '@/lib/tools/bff-route';
import { LIVE_PLATFORMS, type LiveQuality, type LiveSettings } from '@/lib/tools/adapters/tools';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const QUALITIES: LiveQuality[] = ['auto', 'high', 'saver'];
const RESOLUTIONS = ['1080p60', '1080p30', '720p60', '720p30'] as const;

export const GET = toolRoute(
  'chalybobs',
  getEnVivo,
  (a, { session }) => a.settings(session.user.id),
  {
    idempotent: true,
  },
);

export const PATCH = toolRoute('chalybobs', getEnVivo, async (a, { req, session }) => {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Parameters<typeof a.saveSettings>[1] = {};
  if (QUALITIES.includes(b.quality as LiveQuality)) patch.quality = b.quality as LiveQuality;
  if (typeof b.clipsAfter === 'boolean') patch.clipsAfter = b.clipsAfter;
  if (typeof b.saveRecording === 'boolean') patch.saveRecording = b.saveRecording;
  if (b.enabled && typeof b.enabled === 'object') {
    patch.enabled = {};
    for (const p of LIVE_PLATFORMS) {
      const v = (b.enabled as Record<string, unknown>)[p];
      if (typeof v === 'boolean') patch.enabled[p] = v;
    }
  }
  if (b.advanced && typeof b.advanced === 'object') {
    const cur = (await a.settings(session.user.id)).advanced;
    const adv = b.advanced as Record<string, unknown>;
    const bitrate = Number(adv.bitrateKbps);
    patch.advanced = {
      bitrateKbps: Number.isFinite(bitrate)
        ? Math.min(Math.max(Math.round(bitrate), 500), 20000)
        : cur.bitrateKbps,
      resolution: (RESOLUTIONS as readonly string[]).includes(String(adv.resolution))
        ? (adv.resolution as LiveSettings['advanced']['resolution'])
        : cur.resolution,
      server: typeof adv.server === 'string' && adv.server.length <= 120 ? adv.server : cur.server,
    };
  }
  return a.saveSettings(session.user.id, patch);
});
