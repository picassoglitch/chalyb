// Clip editor methods (/app/clips/[clipId]) over the engine's hub API
// (ChalyClip chalybclip/api/routers/hub_editor.py).
//
// OWNED BY THE EDITOR WORKSTREAM. Placeholder from the foundation PR: replace
// these methods (and add editor*.ts files next to this one for anything
// beyond the ClipsAdapter contract). Call the engine only through
// `engine(userId)` (client.ts) so auth, errors and the breaker stay shared.

import 'server-only';
import { NotImplementedError } from '../tools';
import type { ClipsAdapter } from '../types';
import type { ClipsEngine } from './client';

export type EditorMethods = Pick<ClipsAdapter, 'getClip' | 'patchClip'>;

export function editorMethods(_engine: (userId: string) => ClipsEngine): EditorMethods {
  return {
    getClip: () => {
      throw new NotImplementedError('ClipsEngineAdapter.getClip');
    },
    patchClip: () => {
      throw new NotImplementedError('ClipsEngineAdapter.patchClip');
    },
  };
}
