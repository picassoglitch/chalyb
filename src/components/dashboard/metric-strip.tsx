'use client';

import { useEffect, useState } from 'react';
import type { StripValue } from '@/lib/data/types';

// THREE tiles: Dinero hoy · Usuarios hoy · Engines vivos/total.
//
// There were six, and four of them ("Ingresos hoy", "Tokens hoy",
// "Suscripciones", "AI calls / min") were repeated by the activity rail on
// the right of the same screen. Detail belongs in the rail; the strip is
// the glance. See telemetry.ts for what backs each id.

const META: Array<{
  id: StripValue['id'];
  label: string;
  led?: boolean;
  format: (v: number) => string;
}> = [
  // getMoneyToday() — the same helper Dinero reads. One number, one source.
  { id: 'rev', label: 'Dinero hoy', format: (v) => `$${v.toLocaleString('es-MX')}` },
  // COUNT(DISTINCT user_id) in usage_events today.
  { id: 'users', label: 'Usuarios hoy', led: true, format: (v) => `${v}` },
  // engines.status = 'active', rendered over the catalogue total below.
  { id: 'engines', label: 'Engines vivos', led: true, format: (v) => `${v}` },
];

/** Two real readings is the minimum that can honestly be called a trend.
 *  Below that the tile shows no line at all — a flat glowing polyline under
 *  a number measured once is decoration, not data. */
const MIN_HIST_POINTS = 2;

function Sparkline({ hist }: { hist: number[] }) {
  if (hist.length < MIN_HIST_POINTS) return null;
  // All-zero history: there is nothing happening, and drawing a neon line
  // along the floor says otherwise.
  if (hist.every((v) => v === 0)) return null;
  const max = Math.max(...hist);
  const min = Math.min(...hist);
  const rng = max - min || 1;
  const pts = hist
    .map((v, i) => `${(i / (hist.length - 1)) * 54},${22 - ((v - min) / rng) * 20 - 1}`)
    .join(' ');
  return (
    <svg className="cc-spark" viewBox="0 0 54 22" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="var(--cc-green)" strokeWidth="1.4" />
    </svg>
  );
}

export function MetricStrip({ totalEngines }: { totalEngines: number }) {
  const [strip, setStrip] = useState<StripValue[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const src = new EventSource('/api/stream');
    src.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.kind === 'strip' && Array.isArray(data.strip)) {
          setStrip(data.strip as StripValue[]);
          setConnected(true);
        }
      } catch {
        /* ignore parse errors */
      }
    };
    return () => src.close();
  }, []);

  const byId = new Map(strip.map((s) => [s.id, s]));
  return (
    <div className="cc-strip">
      {META.map((m) => {
        const v = byId.get(m.id);
        return (
          <div key={m.id} className="cc-metric">
            <div className="cc-metric-l">
              {m.led && connected && <span className="cc-metric-led" />}
              {m.label}
            </div>
            <div className="cc-metric-v">
              {/* Until the stream has answered once, the tile says so. It
                  used to render "0" / "$0", which is a claim, not a
                  loading state. */}
              {v ? m.format(v.value) : '—'}
              {m.id === 'engines' && <small>/ {totalEngines}</small>}
            </div>
            <Sparkline hist={v?.hist ?? []} />
          </div>
        );
      })}
    </div>
  );
}
