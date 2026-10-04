// POST /api/tools/chalybobs/clip-now — "Hacer clip de este momento"
// (§6.2): the last minute of the live recording becomes a Clips job, so it
// shows in "En proceso" of /app/clips. Credits are spent only when the clip
// is ready (the Clips job settles like any other).

import { getEnVivo } from '@/lib/tools/registry';
import { toolRoute } from '@/lib/tools/bff-route';
import { getClipsAdapter } from '@/lib/tools/adapters/clips';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

class NoRecording extends Error {
  readonly code = 'FORBIDDEN';
}
class NoClips extends Error {
  readonly code = 'NOT_IMPLEMENTED';
}

export const POST = toolRoute('chalybobs', getEnVivo, async (a, { session, entitlements }) => {
  const clips = getClipsAdapter();
  if (!clips || entitlements.tools.chalybclip?.state !== 'included') throw new NoClips('clips');
  const moment = await a.clipMoment(session.user.id, 60);
  if (!moment) throw new NoRecording('no recording');
  const job = await clips.createJob({
    userId: session.user.id,
    sourceUrl: moment.sourceUrl,
    format: 'vertical',
    count: 3,
  });
  if (!job.ok) throw new NoRecording(job.reason);
  return { jobId: job.jobId };
});
