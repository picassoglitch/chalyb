// POST /api/tools/chalybobs/command — start / stop / scene / mic / cam /
// clips-after (§1.3 POST /devices/{id}/commands). Ending a stream leaves a
// notice in Avisos with its duration.

import { getLocale } from 'next-intl/server';
import { getEnVivo } from '@/lib/tools/registry';
import { toolRoute } from '@/lib/tools/bff-route';
import { addUserNotice, noticeText } from '@/lib/notifications/user';
import { formatDuration } from '@/lib/tools/envivo-core';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

class BadCommand extends Error {
  readonly code = 'FORBIDDEN';
}

export const POST = toolRoute('chalybobs', getEnVivo, async (a, { req, session }) => {
  const body = (await req.json().catch(() => ({}))) as { type?: string; sceneId?: string };
  const u = session.user.id;
  switch (body.type) {
    case 'start_stream':
      return { status: await a.start(u), endedSec: null };
    case 'set_scene':
      return {
        status: await a.setScene(u, String(body.sceneId ?? '').slice(0, 64)),
        endedSec: null,
      };
    case 'set_mic':
      return { status: await a.toggle(u, 'mic'), endedSec: null };
    case 'set_cam':
      return { status: await a.toggle(u, 'cam'), endedSec: null };
    case 'set_clips_after':
      return { status: await a.toggle(u, 'clipsAfter'), endedSec: null };
    case 'stop_stream': {
      const before = await a.status(u);
      const status = await a.stop(u);
      if (!before.liveSince) return { status, endedSec: null };
      const endedSec = Math.max(1, Math.round((Date.now() - Date.parse(before.liveSince)) / 1000));
      await addUserNotice({
        userId: u,
        kind: 'liveEnded',
        ...(await noticeText(
          'liveEnded',
          { duracion: formatDuration(endedSec) },
          await getLocale(),
        )),
        href: '/app/en-vivo/transmisiones',
        dedupeKey: `live:${before.liveSince}`,
      }).catch(() => {});
      const recordingUrl = (await a.streams(u))[0]?.recordingUrl ?? null;
      return { status, endedSec, recordingUrl };
    }
    default:
      throw new BadCommand('unknown command');
  }
});
