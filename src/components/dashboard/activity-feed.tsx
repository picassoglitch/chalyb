'use client';

import { useEffect, useState } from 'react';
import type { ActivityEvent } from '@/lib/data/types';

const COLOR: Record<string, string> = {
  g: 'var(--cc-green)',
  c: 'var(--cc-cyan)',
  p: 'var(--cc-purple)',
  a: 'var(--cc-amber)',
  r: 'var(--cc-red)',
  o: 'var(--cc-txt-4)',
};

interface RailStats {
  jobsPerHour: number;
  queue: number;
  tokensToday: string;
  revenueToday: number;
}

export function ActivityFeedLive() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [rail, setRail] = useState<RailStats | null>(null);

  useEffect(() => {
    const src = new EventSource('/api/stream');
    src.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.kind === 'activity' && data.event) {
          setEvents((prev) => [data.event as ActivityEvent, ...prev].slice(0, 26));
        } else if (data.kind === 'rail' && data.rail) {
          setRail(data.rail as RailStats);
        }
      } catch {
        /* ignore */
      }
    };
    return () => src.close();
  }, []);

  return (
    <>
      <div className="cc-feed">
        {events.length === 0 && (
          <div className="cc-empty-feed">Aquí verás la actividad en vivo en cuanto empiece…</div>
        )}
        {events.map((e) => (
          <div key={e.id} className="cc-ev">
            <span
              className="cc-ev-dot"
              style={{ background: COLOR[e.kind], boxShadow: `0 0 6px ${COLOR[e.kind]}` }}
            />
            <div className="cc-ev-c">
              <div className="cc-ev-t">{e.title}</div>
              <div className="cc-ev-m">
                <span className="cc-ev-bot">{e.engine}</span>
                <span>{e.meta}</span>
                <span>{e.time}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="cc-rail-foot">
        {/* Labels mirror what we actually measure in telemetry.tickRail.
            Cola → Suscripciones because we don't have a queue/backpressure
            concept yet; the slot now carries real engine_subscriptions
            count instead of being a smoke-and-mirrors random number. */}
        <div className="cc-rstat">
          <div className="cc-rs-l">Trabajos IA / h</div>
          <div className="cc-rs-v cy">{rail?.jobsPerHour ?? '—'}</div>
        </div>
        <div className="cc-rstat">
          <div className="cc-rs-l">Suscripciones</div>
          <div className="cc-rs-v">{rail?.queue ?? '—'}</div>
        </div>
        <div className="cc-rstat">
          <div className="cc-rs-l">Tokens hoy</div>
          <div className="cc-rs-v">{rail?.tokensToday ?? '—'}</div>
        </div>
        <div className="cc-rstat">
          <div className="cc-rs-l">Ingresos hoy</div>
          <div className="cc-rs-v gr">{rail ? '$' + rail.revenueToday.toLocaleString('es-MX') : '$0'}</div>
        </div>
      </div>
    </>
  );
}
