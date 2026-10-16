// Where a Clips job opens. With the engine (mode "a") a job is an engine
// video at /app/clips/videos/[id]; /app/clips/trabajo/[id] would only
// redirect there, so links go straight to it (one hop less per click).
// Without the engine it is the trabajo wizard.

import { clipsHubMode } from '@/lib/config/flags';

export function clipJobHref(jobId: string): string {
  const id = encodeURIComponent(jobId);
  return clipsHubMode() === 'a' ? `/app/clips/videos/${id}` : `/app/clips/trabajo/${id}`;
}
