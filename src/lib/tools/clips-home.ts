// What the Clips screens inside the app show (TOOLS-SPEC §4), decided from
// the adapter's data. Pure and unit-tested; the pages only render it.

import type { ClipDetail, ClipFormat, ClipJob, ClipJobState, ClipTrim } from './adapters/types';

// ── En proceso (mockup 50) ──────────────────────────────────────────────
/** The 4 steps the row names ("Paso {n} de 4"). */
export const JOB_STEPS = ['receiving', 'finding', 'captions', 'preparing'] as const;
export type JobStep = (typeof JOB_STEPS)[number];

const STEP_OF: Record<Exclude<ClipJobState, 'failed'>, number> = {
  received: 1,
  finding_moments: 2,
  adding_captions: 3,
  ready: 4,
};
const PCT_OF: Record<Exclude<ClipJobState, 'failed'>, number> = {
  received: 10,
  finding_moments: 40,
  adding_captions: 68,
  ready: 100,
};

export function jobProgress(state: Exclude<ClipJobState, 'failed'>): {
  step: number;
  key: JobStep;
  pct: number;
} {
  const step = STEP_OF[state];
  return { step, key: JOB_STEPS[step - 1]!, pct: PCT_OF[state] };
}

export const MAX_PROCESSING_ROWS = 3;

/** Working and failed jobs for "En proceso": at most 3 rows, then "y {n}
 *  más". Failed jobs stay until retried (the person needs to see them). */
export function processingRows(jobs: ClipJob[]): { rows: ClipJob[]; more: number } {
  const open = jobs.filter((j) => j.state !== 'ready');
  return { rows: open.slice(0, MAX_PROCESSING_ROWS), more: Math.max(0, open.length - MAX_PROCESSING_ROWS) };
}

// ── Mis clips ───────────────────────────────────────────────────────────
export type ClipFilter = 'all' | ClipFormat;
export const CLIP_FILTERS: ClipFilter[] = ['all', 'vertical', 'horizontal', 'square'];

export function parseClipFilter(raw: string | undefined): ClipFilter {
  return (CLIP_FILTERS as string[]).includes(raw ?? '') ? (raw as ClipFilter) : 'all';
}

export function filterClips(clips: ClipDetail[], filter: ClipFilter, q: string): ClipDetail[] {
  const needle = q.trim().toLowerCase();
  return clips.filter(
    (c) =>
      (filter === 'all' || c.format === filter) &&
      (needle === '' || c.title.toLowerCase().includes(needle)),
  );
}

/** "Clip {n} de {total}" and the neighbours for the arrows. */
export function clipNeighbours(clips: ClipDetail[], id: string) {
  const i = clips.findIndex((c) => c.id === id);
  if (i < 0) return null;
  return {
    n: i + 1,
    total: clips.length,
    prev: clips[i - 1]?.id ?? null,
    next: clips[i + 1]?.id ?? null,
  };
}

// ── Detalle: título y recorte (mockup 51) ───────────────────────────────
export const TITLE_MAX = 100;
export const TRIM_MIN_S = 5;

export function cleanTitle(raw: string): string | null {
  const t = raw.replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX);
  return t === '' ? null : t;
}

const tenth = (n: number) => Math.round(n * 10) / 10;

/** Keep a trim inside the clip and at least 5 s long (or the whole clip
 *  when it is shorter than that). `moved` says which handle the person
 *  moved, so the other one stays put. */
export function clampTrim(
  trim: ClipTrim,
  durationS: number,
  moved: 'start' | 'end' = 'end',
): ClipTrim {
  const min = Math.min(TRIM_MIN_S, durationS);
  let start = Math.min(Math.max(0, tenth(trim.startS)), durationS);
  let end = Math.min(Math.max(0, tenth(trim.endS)), durationS);
  if (end - start < min) {
    if (moved === 'start') start = Math.max(0, end - min);
    else end = Math.min(durationS, start + min);
    if (end - start < min) {
      if (moved === 'start') end = Math.min(durationS, start + min);
      else start = Math.max(0, end - min);
    }
  }
  return { startS: tenth(start), endS: tenth(end) };
}

/** Keyboard on a trim handle: ← → move 0.1 s, with Shift 1 s. */
export function nudge(key: string, shift: boolean): number {
  const step = shift ? 1 : 0.1;
  if (key === 'ArrowLeft' || key === 'ArrowDown') return -step;
  if (key === 'ArrowRight' || key === 'ArrowUp') return step;
  return 0;
}

export function isValidTrim(t: unknown, durationS: number): t is ClipTrim {
  if (!t || typeof t !== 'object') return false;
  const { startS, endS } = t as Record<string, unknown>;
  if (typeof startS !== 'number' || typeof endS !== 'number') return false;
  const c = clampTrim({ startS, endS }, durationS);
  return c.startS === tenth(startS) && c.endS === tenth(endS);
}

/** 42 → "0:42", 63.4 → "1:03". */
export function mmss(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Gradient frames for clips without a thumbnail (BUILD-SPEC §1.6). */
export const THUMBS = [
  'linear-gradient(160deg,#7B6CFF,#2A1E7A)',
  'linear-gradient(160deg,#30B0C7,#0B3B49)',
  'linear-gradient(160deg,#FF7A45,#6B1A0A)',
  'linear-gradient(160deg,#5B8DEF,#14245C)',
  'linear-gradient(160deg,#34C759,#0B3B1A)',
  'linear-gradient(160deg,#FF5FA2,#4A0E3A)',
];

export function thumbFor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return THUMBS[h % THUMBS.length]!;
}

/** "Hoy" / "Ayer" / "hace 3 días" / a date, in Mexico City days. */
export function relativeDay(iso: string, now: Date, locale: string): string {
  const tz = 'America/Mexico_City';
  const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
  const diff = Math.round((Date.parse(day(now)) - Date.parse(day(new Date(iso)))) / 86_400_000);
  const lang = locale === 'en' ? 'en' : 'es';
  if (diff >= 0 && diff < 7) {
    const s = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' }).format(-diff, 'day');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-MX' : 'en-US', {
    timeZone: tz,
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso));
}
