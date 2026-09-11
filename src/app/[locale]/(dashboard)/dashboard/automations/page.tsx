import { setRequestLocale } from 'next-intl/server';
import { getAutomationCounts } from '@/lib/data/ops';

export const metadata = { title: 'Automatizaciones' };

export default async function AutomationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const c = await getAutomationCounts();

  // The platform's REAL automated flows. Each run count is the number of
  // rows the flow wrote in the last 30 days — not a synthetic counter.
  const flows = [
    {
      id: 'mp-webhook',
      trigger: 'Aviso de pago de Mercado Pago',
      action: 'Guardar el pago y revisar que sea real',
      runs: c.payments30d,
    },
    {
      id: 'tier-activate',
      trigger: 'Pago aprobado',
      action: 'Activar tu tier o cargar tu pack de tokens',
      runs: c.paymentsApproved30d,
    },
    {
      id: 'token-packs',
      trigger: 'Compra de un pack',
      action: 'Cargar tus tokens extra (token_pack_purchases)',
      runs: c.tokenPacks30d,
    },
    {
      id: 'welcome',
      trigger: 'Te registras o ves el saludo de bienvenida',
      action: 'Regalo de bienvenida y prueba de ChalybClip por 7 días',
      runs: c.welcomeGifts30d,
    },
    {
      id: 'usage-ingest',
      trigger: 'Un engine reporta su consumo',
      action: 'Registrar el uso sin duplicarlo (usage_events)',
      runs: c.usageEvents30d,
    },
    {
      id: 'provisioning',
      trigger: 'Mejoras tu plan o eliges un engine',
      action: 'Darte acceso al instante (engine_subscriptions)',
      runs: c.subscriptions30d,
    },
    {
      id: 'audit',
      trigger: 'Cambia tu tier, tu rol o tus tokens',
      action: 'Dejar registro de lo que pasó (audit log)',
      runs: c.auditEvents30d,
    },
  ].sort((a, b) => b.runs - a.runs);

  const activeFlows = flows.filter((f) => f.runs > 0);
  const totalRuns = flows.reduce((s, f) => s + f.runs, 0);

  return (
    <div className="cc-scroll">
      <div className="cc-mod-statgrid">
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Flujos activos (últimos 30 días)</div>
          <div className="cc-mod-stat-v gr">
            {activeFlows.length}
            <small>/ {flows.length}</small>
          </div>
          <div className="cc-mod-stat-sub">tareas que la plataforma hace sola</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Veces que corrieron (últimos 30 días)</div>
          <div className="cc-mod-stat-v cy">{totalRuns.toLocaleString('es-MX')}</div>
          <div className="cc-mod-stat-sub">acciones que hicieron los flujos</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Consumo registrado (últimos 30 días)</div>
          <div className="cc-mod-stat-v am">{c.usageEvents30d.toLocaleString('es-MX')}</div>
          <div className="cc-mod-stat-sub">reportes de uso que mandan los engines</div>
        </div>
      </div>

      <div className="cc-mod-section">
        <div className="cc-mod-sl">Flujos (ordenados por actividad de los últimos 30 días)</div>
        <div className="cc-mod-list">
          {flows.map((f) => (
            <div key={f.id} className="cc-mod-row">
              <div className="cc-mod-ic">⟳</div>
              <div className="cc-mod-body">
                <div className="cc-mod-name">
                  {f.trigger}{' '}
                  <span className={`cc-mod-badge ${f.runs > 0 ? 'gr' : 'am'}`}>
                    {f.runs > 0 ? 'Activo' : 'Sin actividad'}
                  </span>
                </div>
                <div className="cc-mod-sub">→ {f.action}</div>
              </div>
              <div className="cc-mod-right">
                <b>{f.runs.toLocaleString('es-MX')}</b>
                <span>veces en 30 días</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
