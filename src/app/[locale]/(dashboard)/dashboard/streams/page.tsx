import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { listObsStreams, timeAgo } from '@/lib/data/ops';

export const metadata = { title: 'Streams' };

export default async function StreamsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Mandatory double-gate (not just the layout's): listObsStreams reads the
  // ChalybOBS tenant tables with the service-role client — RLS can't protect
  // us here, so the page must.
  const session = await getSessionUser();
  if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN')) {
    redirect('/app');
  }

  const streams = await listObsStreams();
  const live = streams.filter((s) => s.isLive);
  const destinations = streams.flatMap((s) => s.destinations);
  const enabledDests = destinations.filter((d) => d.enabled);
  const problemDests = destinations.filter((d) => d.statusKind && d.statusKind !== 'ok');

  return (
    <div className="cc-scroll">
      <div className="cc-mod-statgrid">
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">En vivo ahora</div>
          <div className="cc-mod-stat-v gr">{live.length}</div>
          <div className="cc-mod-stat-sub">{streams.length} sesiones de ChalybOBS en total</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Destinos activos</div>
          <div className="cc-mod-stat-v cy">{enabledDests.length}</div>
          <div className="cc-mod-stat-sub">{destinations.length} destinos conectados en total</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Destinos con problema</div>
          <div className={`cc-mod-stat-v ${problemDests.length > 0 ? 'am' : 'gr'}`}>
            {problemDests.length}
          </div>
          <div className="cc-mod-stat-sub">token vencido · sin conexión · pendiente</div>
        </div>
      </div>

      <div className="cc-mod-section">
        <div className="cc-mod-sl">Sesiones</div>
        {streams.length === 0 ? (
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
            Todavía nadie ha creado una sesión de ChalybOBS.
          </div>
        ) : (
          <div className="cc-mod-grid cc-mod-grid-2">
            {streams.map((s) => (
              <div key={s.tenantId} className="cc-mod-card">
                <div className="cc-mod-card-head">
                  <span className={`cc-mod-badge ${s.isLive ? 'gr' : 'am'}`}>
                    {s.isLive ? '● LIVE' : '○ OFFLINE'}
                  </span>
                  {s.recordEnabled && <span className="cc-mod-tag">REC</span>}
                </div>
                <h4>{s.title}</h4>
                <p>
                  Tenant:{' '}
                  <b style={{ color: 'var(--cc-txt-2)' }}>
                    {s.ownerEmail ?? `id:${s.tenantId.slice(0, 8)}…`}
                  </b>
                </p>
                <div className="cc-mod-meta">
                  <span>
                    <b className="cy">{s.destinations.filter((d) => d.enabled).length}</b> destinos
                    activos
                  </span>
                  <span>
                    <b>{timeAgo(s.updatedAt)}</b> última actividad
                  </span>
                </div>
                {s.destinations.length > 0 && (
                  <div
                    style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}
                  >
                    {s.destinations.map((d) => (
                      <span
                        key={d.platformId}
                        className={`cc-mod-badge ${
                          !d.enabled ? 'am' : d.statusKind && d.statusKind !== 'ok' ? 'r' : 'gr'
                        }`}
                      >
                        {d.platformId}
                        {d.channelHandle ? ` · ${d.channelHandle}` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
