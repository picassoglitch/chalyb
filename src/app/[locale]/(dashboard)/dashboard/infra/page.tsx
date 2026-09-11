import { setRequestLocale } from 'next-intl/server';
import { listEngines } from '@/lib/data/engines';
import type { Engine, EngineState } from '@/lib/data/types';

export const metadata = { title: 'Infraestructura' };

// Real topology: the nodes/regions each registered engine reports in the
// `engines` table, with live state + latency from `engine_health`. No
// synthetic utilization/RAM/cost — we don't poll cloud-provider APIs yet.
const STATE_BADGE: Record<EngineState, { label: string; cls: string }> = {
  HEALTHY: { label: 'Healthy', cls: 'gr' },
  TRAINING: { label: 'Training', cls: 'cy' },
  RENDERING: { label: 'Rendering', cls: 'pu' },
  DELAYED: { label: 'Delayed', cls: 'am' },
  ERROR: { label: 'Error', cls: 'r' },
  OFFLINE: { label: 'Offline', cls: 'am' },
};

export default async function InfraPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const engines = await listEngines();
  const active = engines.filter((e) => e.status === 'active');

  const byNode = new Map<string, Engine[]>();
  for (const e of engines) {
    const key = `${e.node} · ${e.region}`;
    byNode.set(key, [...(byNode.get(key) ?? []), e]);
  }
  const regions = new Set(engines.map((e) => e.region));
  const latencies = active.map((e) => e.latencyMs).filter((n) => n > 0);
  const avgLatency =
    latencies.length > 0
      ? Math.round(latencies.reduce((s, n) => s + n, 0) / latencies.length)
      : 0;
  const inError = active.filter((e) => e.state === 'ERROR');

  return (
    <div className="cc-scroll">
      <div className="cc-mod-statgrid">
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Engines en línea</div>
          <div className="cc-mod-stat-v gr">
            {active.length}
            <small>/ {engines.length}</small>
          </div>
          <div className="cc-mod-stat-sub">
            {inError.length === 0
              ? 'todo funcionando bien'
              : `${inError.length} con fallas · ${inError.map((e) => e.name).join(', ')}`}
          </div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Nodos registrados</div>
          <div className="cc-mod-stat-v pu">{byNode.size}</div>
          <div className="cc-mod-stat-sub">los que reporta cada engine</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Latencia promedio</div>
          <div className="cc-mod-stat-v cy">
            {avgLatency}
            <small>ms</small>
          </div>
          <div className="cc-mod-stat-sub">solo engines en línea</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Regiones</div>
          <div className="cc-mod-stat-v">{regions.size}</div>
          <div className="cc-mod-stat-sub">{[...regions].join(' · ') || '—'}</div>
        </div>
      </div>

      <div className="cc-mod-section">
        <div className="cc-mod-sl">Nodos ({byNode.size})</div>
        {byNode.size === 0 ? (
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
            Todavía no tienes engines registrados.
          </div>
        ) : (
          <div className="cc-mod-list">
            {[...byNode.entries()].map(([node, nodeEngines]) => (
              <div key={node} className="cc-mod-row">
                <div className="cc-mod-ic">▤</div>
                <div className="cc-mod-body">
                  <div className="cc-mod-name">{node}</div>
                  <div
                    className="cc-mod-sub"
                    style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}
                  >
                    {nodeEngines.map((e) => {
                      const badge = STATE_BADGE[e.state];
                      return (
                        <span key={e.id} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                          {e.icon} {e.name}
                          <span className={`cc-mod-badge ${badge.cls}`}>{badge.label}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="cc-mod-right">
                  <b>
                    {nodeEngines.length} engine{nodeEngines.length === 1 ? '' : 's'}
                  </b>
                  <span>
                    {Math.max(...nodeEngines.map((e) => e.latencyMs))}ms máx
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
