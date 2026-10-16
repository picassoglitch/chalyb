// The clip editor's calls to the Clips engine (/api/hub/v1/clips/{id}/…,
// ChalyClip chalybclip/api/routers/hub_editor.py). Server only: always
// through the shared engine client, so auth, errors and the breaker stay
// shared with the rest of Clips.

import 'server-only';
import { seg, type ClipsEngine } from './client';
import type {
  CaptionsFeed,
  EditorForm,
  EditorPayload,
  ExportQuality,
  FinalizeResult,
  GrowthFeed,
  HookIdeas,
  IntelligenceFeed,
  RenderStatus,
} from './editor-types';

const clip = (id: string, rest = '') => `/clips/${seg(id)}${rest}`;

export function editorApi(engine: ClipsEngine) {
  return {
    load: (id: string, signal?: AbortSignal) =>
      engine.get<EditorPayload>(clip(id, '/editor'), { signal }),
    saveOverlay: (id: string, form: Partial<EditorForm>, signal?: AbortSignal) =>
      engine.put<{ ok: boolean; status: string }>(clip(id, '/overlay'), form, { signal }),
    finalize: (id: string, form: Partial<EditorForm>, signal?: AbortSignal) =>
      engine.post<FinalizeResult>(clip(id, '/finalize'), form, { signal }),
    reject: (id: string, signal?: AbortSignal) =>
      engine.post<{ status: string; stream_id: string }>(clip(id, '/reject'), undefined, {
        signal,
      }),
    revertTrim: (id: string, signal?: AbortSignal) =>
      engine.post<{ ok: boolean; outcome: 'reverted' | 'noop' | 'error' }>(
        clip(id, '/revert-trim'),
        undefined,
        { signal },
      ),
    hooks: (id: string, body: { tone: string; n: number }, signal?: AbortSignal) =>
      engine.post<HookIdeas>(clip(id, '/hooks'), body, { signal }),
    pref: (body: { field: string; value: string | number | boolean }, signal?: AbortSignal) =>
      engine.post<{ ok: boolean }>('/brand-kit/prefs', body, { signal }),
    captions: (id: string, signal?: AbortSignal) =>
      engine.get<CaptionsFeed>(clip(id, '/captions'), { signal }),
    waveform: (id: string, signal?: AbortSignal) =>
      engine.get<number[]>(clip(id, '/waveform'), { signal }),
    intelligence: (id: string, signal?: AbortSignal) =>
      engine.get<IntelligenceFeed>(clip(id, '/intelligence'), { signal }),
    growth: (id: string, signal?: AbortSignal) =>
      engine.get<GrowthFeed>(clip(id, '/growth'), { signal }),
    render: (id: string, quality: ExportQuality, signal?: AbortSignal) =>
      engine.post<RenderStatus>(clip(id, '/render'), undefined, { query: { quality }, signal }),
    renderStatus: (id: string, quality: ExportQuality, signal?: AbortSignal) =>
      engine.get<RenderStatus>(clip(id, '/render-status'), { query: { quality }, signal }),
    renderRetry: (id: string, quality: ExportQuality, signal?: AbortSignal) =>
      engine.post<RenderStatus>(clip(id, '/render-retry'), undefined, {
        query: { quality },
        signal,
      }),
    /** Raw engine response for a byte route (media, thumbnail, download). */
    bytes: (
      id: string,
      what: 'media' | 'thumbnail' | 'download',
      opts: { range?: string | null; quality?: ExportQuality; signal?: AbortSignal } = {},
    ) =>
      engine.get<Response>(clip(id, `/${what}`), {
        raw: true,
        signal: opts.signal,
        query: what === 'download' ? { quality: opts.quality ?? '1080' } : undefined,
        headers: opts.range ? { Range: opts.range } : undefined,
      }),
  };
}

export type EditorApi = ReturnType<typeof editorApi>;
