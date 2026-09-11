import { setRequestLocale } from 'next-intl/server';
import { getQueueThroughput, timeAgo } from '@/lib/data/ops';

export const metadata = { title: 'Movimiento' };

// There is no queue/broker telemetry in the platform yet — what IS real is
// the ingest throughput per engine (usage_events in the last 24h). When an
// engine starts reporting queue depth, this page is where it lands.
export default async function QueuesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const engines = await getQueueThroughput();
  const total24h = engines.reduce((s, e) => s + e.events24h, 0);
  const total1h = engines.reduce((s, e) => s + e.events1h, 0);
  const max24h = Math.max(1, ...engines.map((e) => e.events24h));

  return (
    <div className="cc-scroll">
      <div className="cc-mod-statgrid">
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Engines que reportaron (24h)</div>
          <div className="cc-mod-stat-v gr">{engines.length}</div>
          <div className="cc-mod-stat-sub">vía /api/engines/[slug]/usage</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Eventos (24h)</div>
          <div className="cc-mod-stat-v cy">{total24h.toLocaleString('es-MX')}</div>
          <div className="cc-mod-stat-sub">{total1h.toLocaleString('es-MX')} en la última hora</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Colas de broker</div>
          <div className="cc-mod-stat-v">—</div>
          <div className="cc-mod-stat-sub">aún no conectamos los datos de las colas</div>
        </div>
      </div>

      <div className="cc-mod-section">
        <div className="cc-mod-sl">Movimiento por engine (24h)</div>
        {engines.length === 0 ? (
          <div
            style={{
              padding: '40px 24px',
              border: '1px dashed var(--cc-line-2)',
              borderRadius: 'var(--cc-r-l)',
              textAlign: 'center',
              color: 'var(--cc-txt-3)',
              fontSize: 13,
            }}
          >
            Ningún engine envió eventos en las últimas 24 horas.
          </div>
        ) : (
          <div className="cc-mod-list">
            {engines.map((e) => {
              const pct = Math.round((e.events24h / max24h) * 100);
              const fill = e.events1h > 0 ? 'gr' : 'am';
              return (
                <div key={e.engineId} className="cc-mod-row">
                  <div className="cc-mod-ic">{e.icon}</div>
                  <div className="cc-mod-body">
                    <div className="cc-mod-name">
                      {e.name}{' '}
                      <span className={`cc-mod-badge ${fill}`}>
                        {e.events1h > 0 ? 'Activo' : 'Sin eventos (1h)'}
                      </span>
                    </div>
                    <div
                      className="cc-mod-sub"
                      style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}
                    >
                      <span>{e.kinds.join(' · ')}</span>
                      <span className="cc-bar-track" style={{ maxWidth: 120 }}>
                        <span className={`cc-bar-fill ${fill}`} style={{ width: `${pct}%` }} />
                      </span>
                    </div>
                  </div>
                  <div className="cc-mod-right">
                    <b>{e.events24h.toLocaleString('es-MX')}</b>
                    <span>{e.lastEventAt ? `último ${timeAgo(e.lastEventAt)}` : '—'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
