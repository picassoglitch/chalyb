// The real Clips adapter (TOOL_HUB_MODE_CHALYBCLIP=a): the ClipsAdapter
// contract, assembled from the three workstreams' method sets, plus direct
// access to the engine client for screens beyond that contract.
//
//   core.ts     jobs, clip list, settings, capabilities (Clips core)
//   editor.ts   getClip / patchClip                      (editor)
//   publish.ts  accounts / connectUrl / publishClip      (publishing)
//   client.ts   the one HTTP client (auth, errors)       (shared)

import 'server-only';
import type { ClipsAdapter } from '../types';
import { clipsEngine, type ClipsEngine } from './client';
import { coreMethods } from './core';
import { editorMethods } from './editor';
import { publishMethods } from './publish';

export interface ClipsEngineAdapter extends ClipsAdapter {
  /** The engine client acting as `userId`, for endpoints outside the
   *  ClipsAdapter contract (streams, live, brand kits…). */
  engine(userId: string): ClipsEngine;
}

export function createEngineClipsAdapter(
  engine: (userId: string) => ClipsEngine = (userId) => clipsEngine(userId),
): ClipsEngineAdapter {
  return {
    ...coreMethods(engine),
    ...editorMethods(engine),
    ...publishMethods(engine),
    engine,
  };
}
