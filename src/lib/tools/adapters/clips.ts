// Which Clips adapter the hub uses, from TOOL_HUB_MODE_CHALYBCLIP:
//
//   off   (default) no in-hub screens. The Clips screens hand off to the
//         Clips app over SSO (P0-14), exactly like "Abrir".
//   a     the engine's hub API (ChalyClip /api/hub/v1), see clips/adapter.ts.
//   mock  the in-memory adapter (tests, local development, previews).

import 'server-only';
import { clipsHubMode } from '@/lib/config/flags';
import { createMockClipsAdapter } from './mock';
import { createEngineClipsAdapter, type ClipsEngineAdapter } from './clips/adapter';
import type { ClipsAdapter } from './types';

const globalForClips = globalThis as unknown as {
  __chalybMockClips?: ClipsAdapter;
  __chalybEngineClips?: ClipsEngineAdapter;
};

/** The adapter for in-hub screens, or null when the hub hands off to the app. */
export function getClipsAdapter(): ClipsAdapter | null {
  const mode = clipsHubMode();
  if (mode === 'a') return getClipsEngineAdapter();
  if (mode !== 'mock') return null;
  // One store per server process, surviving dev hot reloads.
  globalForClips.__chalybMockClips ??= createMockClipsAdapter();
  return globalForClips.__chalybMockClips;
}

/** The engine adapter (mode a only): screens beyond the ClipsAdapter
 *  contract (streams, live, brand kits…) need the engine itself. */
export function getClipsEngineAdapter(): ClipsEngineAdapter | null {
  if (clipsHubMode() !== 'a') return null;
  globalForClips.__chalybEngineClips ??= createEngineClipsAdapter();
  return globalForClips.__chalybEngineClips;
}
