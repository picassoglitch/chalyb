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
    load: (id: string, signal?: AbortSignal, lang: 'es' | 'en' = 'es') =>
      engine.get<EditorPayload>(clip(id, '/editor'), { signal, query: { lang } }),
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
    intelligence: (id: string, signal?: AbortSignal, lang: 'es' | 'en' = 'es') =>
      engine.get<IntelligenceFeed>(clip(id, '/intelligence'), { signal, query: { lang } }),
    trim: (id: string, body: { start_s: number; end_s: number }, signal?: AbortSignal) =>
      engine.post<{ ok: boolean; outcome: string; start_s: number; end_s: number }>(
        clip(id, '/trim'),
        body,
        { signal },
      ),
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
    /** Absolute URL for a signed engine media path, else null. */
    mediaUrl: (path: string | null | undefined) => engine.mediaUrl(path),
    /** The editor payload with its media links made absolute. */
    async loadAbsolute(
      id: string,
      signal?: AbortSignal,
      lang: 'es' | 'en' = 'es',
    ): Promise<EditorPayload> {
      const p = await engine.get<EditorPayload>(clip(id, '/editor'), { signal, query: { lang } });
      return withAbsoluteMedia(p, (x) => engine.mediaUrl(x));
    },
    /** A render status with its download link made absolute. */
    async absolute(s: RenderStatus): Promise<RenderStatus> {
      return { ...s, download: await engine.mediaUrl(s.download) };
    },
  };
}

export type EditorApi = ReturnType<typeof editorApi>;

export async function withAbsoluteMedia(
  p: EditorPayload,
  abs: (path: string | null | undefined) => Promise<string | null>,
): Promise<EditorPayload> {
  const media = p.media ?? { preview: null, thumbnail: null };
  return {
    ...p,
    media: {
      preview: await abs(media.preview),
      thumbnail: await abs(media.thumbnail),
      formats: {
        horizontal: await abs(media.formats?.horizontal),
        square: await abs(media.formats?.square),
      },
    },
  };
}
