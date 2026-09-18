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
  activeSubscriptions: number;
  tokensToday: string;
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
                {/* `meta` is a person or a plain phrase now. It used to carry
                    raw event keys like "llm.tokens" straight from the
                    database, which reads as debug output in a default view. */}
                {e.meta && <span>{e.meta}</span>}
                <span>{e.time}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Three numbers the top strip does NOT show. "Ingresos hoy" and
          "Tokens hoy" used to appear here AND up there, same screen, two
          separate queries — so a disagreement between them was the
          operator's problem to adjudicate. */}
      <div className="cc-rail-foot">
        <div className="cc-rstat">
          <div className="cc-rs-l">Trabajos IA / h</div>
          <div className="cc-rs-v cy">{rail ? rail.jobsPerHour : '—'}</div>
        </div>
        <div className="cc-rstat">
          <div className="cc-rs-l">Suscripciones</div>
          <div className="cc-rs-v">{rail ? rail.activeSubscriptions : '—'}</div>
        </div>
        <div className="cc-rstat">
          <div className="cc-rs-l">Tokens hoy</div>
          <div className="cc-rs-v">{rail ? rail.tokensToday : '—'}</div>
        </div>
      </div>
    </>
  );
}
