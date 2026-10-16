// Clip editor methods (/app/clips/[clipId]) over the engine's hub API
// (ChalyClip chalybclip/api/routers/hub_editor.py): the ClipsAdapter
// contract's getClip / patchClip. The full editor (verdict, overlays,
// hooks, export) goes through editor-api.ts.

import 'server-only';
import type { ClipDetail, ClipPatch, ClipsAdapter } from '../types';
import type { ClipsEngine } from './client';
import { ClipsEngineError } from './errors';
import { editorApi } from './editor-api';
import type { EditorPayload } from './editor-types';

export type EditorMethods = Pick<ClipsAdapter, 'getClip' | 'patchClip'>;

const BFF = '/api/tools/chalybclip/clips';

/** The engine's editor payload as the generic clip shape the other Clips
 *  screens use. Engine clips are always 9:16 and never trimmed by hand. */
export function clipDetailFromEditor(p: EditorPayload): ClipDetail {
  const id = encodeURIComponent(p.clip.id);
  return {
    id: p.clip.id,
    jobId: p.clip.stream_id,
    title: p.form.title_text || p.clip.stream_title || '',
    sourceDurationSec: p.clip.duration_s,
    format: 'vertical',
    captionsOn: p.form.captions_enabled,
    trim: { startS: 0, endS: p.clip.duration_s },
    createdAt: p.clip.created_at,
    downloadUrl: `${BFF}/${id}/download?quality=1080`,
    thumbUrl: p.clip.has_thumbnail ? `${BFF}/${id}/thumbnail` : null,
    previewUrl: `${BFF}/${id}/media`,
  };
}

const notFound = (err: unknown) =>
  err instanceof ClipsEngineError && err.engineCode === 'not_found';

export function editorMethods(engine: (userId: string) => ClipsEngine): EditorMethods {
  return {
    async getClip(userId, clipId, signal) {
      try {
        return clipDetailFromEditor(await editorApi(engine(userId)).load(clipId, signal));
      } catch (err) {
        if (notFound(err)) return null;
        throw err;
      }
    },
    async patchClip(userId, clipId, patch: ClipPatch, signal) {
      // Title and captions map onto the editor's overlay; the engine has no
      // manual trim or format change, so those are ignored.
      const api = editorApi(engine(userId));
      try {
        const cur = await api.load(clipId, signal);
        const form = { ...cur.form };
        if (patch.title !== undefined) form.title_text = patch.title;
        if (patch.captionsOn !== undefined) form.captions_enabled = patch.captionsOn;
        await api.saveOverlay(clipId, form, signal);
        return clipDetailFromEditor(await api.load(clipId, signal));
      } catch (err) {
        if (notFound(err)) return null;
        throw err;
      }
    },
  };
}
