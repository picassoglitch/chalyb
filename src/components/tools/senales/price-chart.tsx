// The detail chart (TOOLS-SPEC §5.3): past price only — a line, a soft area,
// 3 axis marks, days below and the point where the notice was made. No
// target lines, stops, projections or expected gains.

import { chartGeometry, formatRefPrice, SIGNAL_TZ } from '@/lib/tools/signals-view';
import type { PricePoint, SignalRange } from '@/lib/tools/adapters/tools';

const W = 640;
const H = 220;

export function PriceChart({
  series,
  signalAt,
  range,
  locale,
  label,
  markerLabel,
}: {
  series: PricePoint[];
  signalAt: string;
  range: SignalRange;
  locale: string;
  label: string;
  markerLabel: string;
}) {
  const g = chartGeometry(series, W, H, signalAt);
  if (!g) return null;
  const loc = locale === 'es' ? 'es-MX' : 'en-US';
  const fmt = new Intl.DateTimeFormat(
    loc,
    range === '1d'
      ? { timeZone: SIGNAL_TZ, hour: 'numeric' }
      : { timeZone: SIGNAL_TZ, day: 'numeric', month: 'short' },
  );
  const labels = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const i = Math.round(f * (series.length - 1));
    return { x: (i / (series.length - 1)) * 100, text: fmt.format(new Date(series[i]!.at)) };
  });
  const markerLeft = g.marker ? (g.marker.x / W) * 100 : 0;
  return (
    <figure className="ch-chart" aria-label={label}>
      <div className="ch-chart__plot">
        <ul className="ch-chart__ticks" aria-hidden="true">
          {g.ticks.map((tk) => (
            <li key={tk.y} style={{ top: `${(tk.y / H) * 100}%` }}>
              {formatRefPrice(tk.value, locale).replace(' MXN', '')}
            </li>
          ))}
        </ul>
        <div className="ch-chart__area">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
            <defs>
              <linearGradient id="ch-chart-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {g.ticks.map((tk) => (
              <line
                key={tk.y}
                x1="0"
                x2={W}
                y1={tk.y}
                y2={tk.y}
                className="ch-chart__grid"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <path d={g.area} fill="url(#ch-chart-fill)" />
            <path d={g.line} className="ch-chart__line" vectorEffect="non-scaling-stroke" />
            {g.marker && (
              <line
                x1={g.marker.x}
                x2={g.marker.x}
                y1={0}
                y2={H}
                className="ch-chart__mark"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
          {g.marker && (
            <>
              <span
                className="ch-chart__dot"
                style={{ left: `${markerLeft}%`, top: `${(g.marker.y / H) * 100}%` }}
                aria-hidden="true"
              />
              <span
                className="ch-chart__tag"
                style={{ left: `${Math.min(Math.max(markerLeft, 18), 82)}%` }}
              >
                {markerLabel}
              </span>
            </>
          )}
        </div>
      </div>
      <ul className="ch-chart__days" aria-hidden="true">
        {labels.map((l) => (
          <li key={l.x} style={{ left: `${l.x}%` }}>
            {l.text}
          </li>
        ))}
      </ul>
    </figure>
  );
}
