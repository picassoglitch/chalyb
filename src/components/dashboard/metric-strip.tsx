'use client';

import { useEffect, useState } from 'react';
import type { StripValue } from '@/lib/data/types';

// Six tiles in the top metric strip. IDs still match the StripMetricId
// union for back-compat; what they REPRESENT has changed from the previous
// mock random-walk values to real Supabase queries — see telemetry.ts for
// the exact semantics behind each id. Labels updated to match what's
// actually being measured instead of the original aspirational copy
// ("Streams en vivo", "GPU util", etc.) that we don't have backing data
// for yet.
function formatTokensCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

const META: Array<{
  id: StripValue['id'];
  label: string;
  led?: boolean;
  format: (v: number, total?: number) => string;
}> = [
  // Real: engines.status='active'
  { id: 'active', label: 'Engines activos', led: true, format: (v) => `${v}` },
  // Real: usage_events with kind='llm.tokens' in the last 60s
  { id: 'aicalls', label: 'AI calls / min', format: (v) => `${v}` },
  // Real: SUM(payments.amount_cents)/100 today
  { id: 'rev', label: 'Ingresos hoy', format: (v) => `$${v.toLocaleString('es-MX')}` },
  // Real: COUNT(DISTINCT user_id) in usage_events today
  { id: 'streams', label: 'Usuarios hoy', led: true, format: (v) => `${v}` },
  // Real: SUM(usage_events.amount) today
  { id: 'queue', label: 'Tokens hoy', format: (v) => formatTokensCompact(v) },
  // Real: COUNT(engine_subscriptions WHERE status='active')
  { id: 'gpu', label: 'Suscripciones', format: (v) => `${v}` },
];

function Sparkline({ hist }: { hist: number[] }) {
  if (!hist.length) return <svg className="cc-spark" viewBox="0 0 54 22" />;
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

  useEffect(() => {
    const src = new EventSource('/api/stream');
    src.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.kind === 'strip' && Array.isArray(data.strip)) {
          setStrip(data.strip as StripValue[]);
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
        const value = v?.value ?? 0;
        const hist = v?.hist ?? [];
        return (
          <div key={m.id} className="cc-metric">
            <div className="cc-metric-l">
              {m.led && <span className="cc-metric-led" />}
              {m.label}
            </div>
            <div className="cc-metric-v">
              {m.format(value)}
              {m.id === 'active' && <small>/ {totalEngines}</small>}
            </div>
            <Sparkline hist={hist} />
          </div>
        );
      })}
    </div>
  );
}
