// Where new clips come from, all on one page (/app/clips/nuevo?fuente=…):
// a link, a file upload, your live stream, or a watched channel. The old
// one-source pages (/app/clips/subir, /en-vivo, /canales) redirect here with
// their query kept.

export const CLIP_SOURCES = ['enlace', 'archivo', 'transmision', 'canal'] as const;
export type ClipSource = (typeof CLIP_SOURCES)[number];

export const DEFAULT_CLIP_SOURCE: ClipSource = 'enlace';

/** The source a ?fuente= value names; anything else is the link. */
export function parseClipSource(value: unknown): ClipSource {
  const v = Array.isArray(value) ? value[0] : value;
  return (CLIP_SOURCES as readonly string[]).includes(v as string)
    ? (v as ClipSource)
    : DEFAULT_CLIP_SOURCE;
}

/** The one "Hacer clips" page with that source picked. The link is the
 *  default, so it needs no parameter. */
export function clipSourceHref(source: ClipSource): string {
  return source === DEFAULT_CLIP_SOURCE ? '/app/clips/nuevo' : `/app/clips/nuevo?fuente=${source}`;
}

/** Where an old one-source page sends the person: the one page with that
 *  source picked, every other query parameter kept (e.g. an error). */
export function legacyClipSourceHref(
  source: ClipSource,
  query: Record<string, string | string[] | undefined>,
): string {
  const qs = new URLSearchParams();
  qs.set('fuente', source);
  for (const [key, value] of Object.entries(query)) {
    if (key === 'fuente' || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) qs.append(key, v);
  }
  return `/app/clips/nuevo?${qs.toString()}`;
}
