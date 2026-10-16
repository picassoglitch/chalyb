// Server side of the Publish Center pages (/app/clips/publicar/**): the
// shared gate and the first overview, so each page stays a thin shell.

import 'server-only';
import { loadTool, type ToolGate } from '@/lib/tools/access';
import { runTool } from '@/lib/tools/bff';
import type { ToolError } from '@/lib/tools/bff-core';
import { getClipsEngineAdapter } from '../clips';
import type { ClipsEngineAdapter } from './adapter';
import { CLIPS_SLUG } from './client';

export function loadPublishTool(
  locale: string,
  path: string,
): Promise<ToolGate<ClipsEngineAdapter>> {
  // Mode "a" only: the Publish Center needs the engine's hub API (the mock
  // adapter has no publishing), so anything else is the tool-error state.
  return loadTool(locale, CLIPS_SLUG, path, getClipsEngineAdapter);
}

/** The engine's overview for the first paint, through the BFF's breaker. */
export async function loadPublishOverview<T>(
  adapter: ClipsEngineAdapter,
  userId: string,
): Promise<{ ok: true; data: T } | { ok: false; error: ToolError }> {
  return runTool(
    CLIPS_SLUG,
    userId,
    (signal) => adapter.engine(userId).get<T>('/publish/overview', { signal }),
    {
      idempotent: true,
      adapterErrorsOnly: true,
    },
  );
}
