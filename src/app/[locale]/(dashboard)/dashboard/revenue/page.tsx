import { setRequestLocale } from 'next-intl/server';
import { listEngines } from '@/lib/data/engines';

export default async function RevenuePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const engines = await listEngines();
  const total = engines.reduce((a, e) => a + e.revenueCents, 0);
  const revenueEngines = engines
    .filter((e) => e.revenueCents > 0)
    .sort((a, b) => b.revenueCents - a.revenueCents);

  return (
    <div className="cc-scroll">
      <div className="cc-mod-statgrid">
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Ingreso mensual estimado</div>
          <div className="cc-mod-stat-v gr">${Math.round((total / 100) * 30).toLocaleString()}</div>
          <div className="cc-mod-stat-sub">proyectado sobre los últimos 30 días</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Lo que ganaste hoy</div>
          <div className="cc-mod-stat-v gr">${Math.round(total / 100).toLocaleString()}</div>
          <div className="cc-mod-stat-sub">+12% más que ayer</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Sistemas que ya te dan dinero</div>
          <div className="cc-mod-stat-v cy">{revenueEngines.length}</div>
          <div className="cc-mod-stat-sub">de {engines.length} en total</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Lo que te costó la IA hoy</div>
          <div className="cc-mod-stat-v am">$84.20</div>
          <div className="cc-mod-stat-sub">te queda 99.2% de margen</div>
        </div>
      </div>

      <div className="cc-mod-section">
        <div className="cc-mod-sl">Cuánto te da cada sistema</div>
        <div className="cc-mod-list">
          {revenueEngines.map((e) => {
            const pct = total > 0 ? (e.revenueCents / total) * 100 : 0;
            return (
              <div key={e.id} className="cc-mod-row">
                <div className="cc-mod-ic">{e.icon}</div>
                <div className="cc-mod-body">
                  <div className="cc-mod-name">{e.name}</div>
                  <div
                    className="cc-mod-sub"
                    style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}
                  >
                    <span>{pct.toFixed(1)}%</span>
                    <span className="cc-bar-track">
                      <span className="cc-bar-fill gr" style={{ width: `${pct}%` }} />
                    </span>
                  </div>
                </div>
                <div className="cc-mod-right">
                  <b className="gr">${Math.round(e.revenueCents / 100).toLocaleString()}</b>
                  <span>{e.type}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
