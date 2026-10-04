// POST /api/tools/chalybobs/clip-now — "Hacer clip de este momento"
// (§6.2): the last minute of the live recording becomes a Clips job, so it
// shows in "En proceso" of /app/clips. Credits are spent only when the clip
// is ready (the Clips job settles like any other).

import { getEnVivo, hubRunsTool } from '@/lib/tools/registry';
import { toolRoute } from '@/lib/tools/bff-route';
import { submitClips } from '@/lib/tools/clips-jobs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** No recording to cut, or Clips isn't in the plan / not running: the
 *  person's state, never an En vivo outage. */
class CannotClip extends Error {
  readonly code = 'FORBIDDEN';
}

export const POST = toolRoute('chalybobs', getEnVivo, async (a, { session, entitlements }) => {
  if (entitlements.tools.chalybclip?.state !== 'included' || !hubRunsTool('chalybclip'))
    throw new CannotClip('clips not included');
  const moment = await a.clipMoment(session.user.id, 60);
  if (!moment) throw new CannotClip('no recording');
  // The Clips job policy: automatic retries, the clips.job_failed audit and
  // credits only when ready. Its failures are Clips', not En vivo's (only
  // the En vivo adapter's errors count against this route's breaker).
  const job = await submitClips({
    userId: session.user.id,
    sourceUrl: moment.sourceUrl,
    format: 'vertical',
    count: 3,
  });
  if (!job) throw new CannotClip('clips not running');
  if (!job.ok) throw new CannotClip(job.reason);
  return { jobId: job.jobId };
});
