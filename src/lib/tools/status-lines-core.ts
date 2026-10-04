// Pure decisions for the Tus herramientas status lines (TOOLS-SPEC §7.2).

export interface ToolStatusLine {
  /** Key under tools.status. */
  key: string;
  values: Record<string, string | number>;
  /** Amber dot: something is missing ("Te falta un paso: conectar"). */
  warn?: boolean;
}

const dayKey = (d: Date, tz: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);

/** "hoy" / "ayer" / "el 3 oct", in the tool's time zone. */
export function relativeDay(iso: string, now: Date, locale: string, tz: string): string {
  const d = new Date(iso);
  const today = dayKey(now, tz);
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000), tz);
  const k = dayKey(d, tz);
  const es = locale !== 'en';
  if (k === today) return es ? 'hoy' : 'today';
  if (k === yesterday) return es ? 'ayer' : 'yesterday';
  const date = new Intl.DateTimeFormat(es ? 'es-MX' : 'en-US', {
    timeZone: tz,
    day: 'numeric',
    month: 'short',
  }).format(d);
  return es ? `el ${date}` : `on ${date}`;
}

export function clipsLine(
  s: { inProgress: number; ready: number; latestReadyAt: string | null },
  now: Date,
  locale: string,
  tz: string,
): ToolStatusLine {
  const cuando = s.latestReadyAt ? relativeDay(s.latestReadyAt, now, locale, tz) : '';
  if (s.inProgress > 0 && s.ready > 0)
    return { key: 'clipsBoth', values: { n: s.inProgress, m: s.ready, cuando } };
  if (s.inProgress > 0) return { key: 'clipsWorking', values: { n: s.inProgress } };
  if (s.ready > 0) return { key: 'clipsReady', values: { m: s.ready, cuando } };
  return { key: 'clipsNone', values: {} };
}

export function signalsLine(createdAt: string[], now: Date, tz: string): ToolStatusLine {
  const today = dayKey(now, tz);
  const n = createdAt.filter((iso) => dayKey(new Date(iso), tz) === today).length;
  return n > 0 ? { key: 'signalsToday', values: { n } } : { key: 'signalsNone', values: {} };
}

export function liveLine(s: { connected: boolean; live: boolean }): ToolStatusLine {
  if (s.live) return { key: 'liveOn', values: {} };
  if (s.connected) return { key: 'liveReady', values: {} };
  return { key: 'liveSetup', values: {}, warn: true };
}
