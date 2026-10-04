// Opciones avanzadas (SCR-06) → job options. Pure: anything out of range is
// dropped, so "si no tocas nada" means the engine's defaults.

import { CAPTION_STYLES, type CaptionStyle, type ClipJobOptions } from './adapters/types';

export const MAX_EXTRA_LINKS = 4;

export function parseClipOptions(get: (k: string) => unknown): ClipJobOptions {
  const out: ClipJobOptions = {};
  const style = String(get('captionStyle') ?? '');
  if ((CAPTION_STYLES as readonly string[]).includes(style))
    out.captionStyle = style as CaptionStyle;
  const lang = get('captionLang');
  if (lang === 'es' || lang === 'en') out.captionLang = lang;
  const sec = (k: string) => {
    const raw = String(get(k) ?? '').trim();
    const n = raw === '' ? NaN : Number(raw);
    return Number.isInteger(n) && n >= 15 && n <= 60 ? n : undefined;
  };
  const min = sec('minSec');
  const max = sec('maxSec');
  if (min !== undefined && (max === undefined || min <= max)) out.minSec = min;
  if (max !== undefined && (min === undefined || min <= max)) out.maxSec = max;
  return out;
}

/** The extra links from "Subir varios videos a la vez": one per line, the
 *  main link removed, duplicates removed, at most MAX_EXTRA_LINKS. */
export function extraLinks(raw: unknown, main: string): string[] {
  const seen = new Set([main]);
  const out: string[] = [];
  for (const line of String(raw ?? '').split(/\s+/)) {
    const v = line.trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length === MAX_EXTRA_LINKS) break;
  }
  return out;
}
