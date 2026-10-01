// Which Clips adapter the hub uses, from TOOL_HUB_MODE_CHALYBCLIP:
//
//   off   (default) no in-hub jobs. The Clips screens hand off to the Clips
//         app over SSO (P0-14), exactly like "Abrir".
//   mock  the in-memory adapter (tests, local development, previews).
//   on    the engine's job API. TODO(OPS-13, Q4): the Clips team has not
//         published one yet, so `on` behaves as `off` until it exists. Wiring
//         a guessed contract would fail in production in ways the customer
//         would see; the hand-off works today.

import 'server-only';
import { clipsHubMode } from '@/lib/config/flags';
import { createMockClipsAdapter } from './mock';
import type { ClipsAdapter } from './types';

const globalForClips = globalThis as unknown as { __chalybMockClips?: ClipsAdapter };

/** The adapter for in-hub jobs, or null when the hub hands off to the app. */
export function getClipsAdapter(): ClipsAdapter | null {
  if (clipsHubMode() !== 'mock') return null;
  // One store per server process, surviving dev hot reloads.
  globalForClips.__chalybMockClips ??= createMockClipsAdapter();
  return globalForClips.__chalybMockClips;
}
