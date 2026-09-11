import { setRequestLocale } from 'next-intl/server';
import { formatCompact, formatUsdMicros, getAnalytics } from '@/lib/data/ops';

export const metadata = { title: 'Analytics' };

// Lightweight inline sparkline (no client JS — pure SVG).
function MiniLine({ data, color = 'var(--cc-green)' }: { data: number[]; color?: string }) {
  if (!data.length) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const rng = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${40 - ((v - min) / rng) * 36 - 2}`)
    .join(' ');
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: '100%', height: 64 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  TRADING: 'Trading',
  CONTENT: 'Content AI',
  STREAMING: 'Streaming',
  AGENTS: 'AI Agents',
  RESEARCH: 'Research',
  INTERNAL: 'Internal',
};

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const a = await getAnalytics();
  const revenue30d = a.revenue30dCents / 100;
  const revenuePrev = a.revenuePrev30dCents / 100;
  const revenueDeltaPct =
    revenuePrev > 0 ? Math.round(((revenue30d - revenuePrev) / revenuePrev) * 100) : null;

  return (
    <div className="cc-scroll">
      <div className="cc-mod-statgrid">
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Tareas de IA en 24h</div>
          <div className="cc-mod-stat-v cy">{a.jobs24h.toLocaleString('es-MX')}</div>
          <div className="cc-mod-stat-sub">{a.jobs30d.toLocaleString('es-MX')} en los últimos 30 días</div>
          <MiniLine data={a.jobsDaily} color="var(--cc-cyan)" />
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Ingresos en 30 días</div>
          <div className="cc-mod-stat-v gr">
            ${revenue30d.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
          <div className="cc-mod-stat-sub">
            {revenueDeltaPct === null
              ? 'aún no hay un mes anterior con qué comparar'
              : `${revenueDeltaPct >= 0 ? '+' : ''}${revenueDeltaPct}% frente al mes pasado`}
          </div>
          <MiniLine data={a.revenueDaily} color="var(--cc-green)" />
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Tokens IA en 30 días</div>
          <div className="cc-mod-stat-v am">{formatCompact(a.tokens30d)}</div>
          <div className="cc-mod-stat-sub">
costo del proveedor: {formatUsdMicros(a.cost30dUsdMicros)}
          </div>
          <MiniLine data={a.tokensDaily} color="var(--cc-amber)" />
        </div>
      </div>

      <div className="cc-mod-section">
        <div className="cc-mod-sl">En qué se gastaron tus tokens (últimos 30 días)</div>
        {a.categories.length === 0 ? (
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
Aún no hay consumo en este periodo.
            <br />
            <span
              style={{
                color: 'var(--cc-txt-4)',
                fontSize: 12,
                fontFamily: 'var(--cc-mono), monospace',
                marginTop: 6,
                display: 'inline-block',
              }}
            >
              En cuanto tus engines empiecen a reportar su uso, lo verás aquí.
            </span>
          </div>
        ) : (
          <div className="cc-mod-list">
            {a.categories.map((c) => (
              <div key={c.category} className="cc-mod-row">
                <div className="cc-mod-body">
                  <div className="cc-mod-name">{CATEGORY_LABEL[c.category] ?? c.category}</div>
                  <div
                    className="cc-mod-sub"
                    style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}
                  >
                    <span>{c.pct}%</span>
                    <span className="cc-bar-track">
                      <span className="cc-bar-fill gr" style={{ width: `${c.pct}%` }} />
                    </span>
                    <span>{formatCompact(c.tokens)} tokens</span>
                  </div>
                </div>
                <div className="cc-mod-right">
                  <b className="gr">{formatUsdMicros(c.costUsdMicros)}</b>
                  <span>costo en 30 días</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
