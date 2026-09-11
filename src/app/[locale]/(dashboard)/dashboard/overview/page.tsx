import { setRequestLocale } from 'next-intl/server';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import { listEngines } from '@/lib/data/engines';
import { getPlatformTokenStats } from '@/lib/usage/platform-stats';

export const metadata = { title: 'Resumen general' };

// Format token counts as a compact string. We render large numbers a lot
// (millions of tokens per engine) so the K/M/B suffix keeps cards aligned.
function formatTokens(n: number): string {
  if (n === 0) return '0';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString('es-MX');
}

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Run the engines query and the token-stats query in parallel — both feed
  // independent sections of the page and neither needs the other's output.
  const [engines, tokenStats] = await Promise.all([
    listEngines(),
    getPlatformTokenStats(),
  ]);
  const active = engines.filter(
    (e) => e.status === 'active' && e.stateCode !== 'o' && e.stateCode !== 'r',
  ).length;
  const totalRev = engines.reduce((a, e) => a + e.revenueCents, 0);
  const errored = engines.filter((e) => e.stateCode === 'r').length;
  const comingSoon = engines.filter((e) => e.status === 'coming_soon').length;
  const personas = engines.filter((e) => e.persona).length;

  // Top by health for the "Top engines" list — falls back to revenue when
  // multiple engines are at the same health level. Filter out offline so the
  // list shows things you can actually look at.
  const topByHealth = [...engines]
    .filter((e) => e.status !== 'deprecated')
    .sort((a, b) => {
      if (b.health !== a.health) return b.health - a.health;
      return b.revenueCents - a.revenueCents;
    })
    .slice(0, 6);

  const needAttention = engines.filter((e) => e.stateCode === 'r' || e.stateCode === 'a');

  return (
    <div className="cc-scroll">
      <div className="cc-mod-statgrid">
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Engines activos</div>
          <div className="cc-mod-stat-v gr">
            {active}
            <small>/ {engines.length}</small>
          </div>
          <div className="cc-mod-stat-sub">
            {comingSoon} próximamente · {errored} con errores
          </div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Ingresos mes</div>
          <div className={`cc-mod-stat-v ${totalRev > 0 ? 'gr' : ''}`}>
            ${Math.round(totalRev / 100).toLocaleString()}
          </div>
          <div className="cc-mod-stat-sub">
            {totalRev > 0
              ? 'suma de todos tus engines'
              : 'todavía no tienes ingresos'}
          </div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Tokens IA · mes</div>
          <div className={`cc-mod-stat-v ${tokenStats.monthTotal > 0 ? 'cy' : ''}`}>
            {formatTokens(tokenStats.monthTotal)}
          </div>
          <div className="cc-mod-stat-sub">
            {tokenStats.activeUsersThisMonth} usuario
            {tokenStats.activeUsersThisMonth === 1 ? '' : 's'} activo
            {tokenStats.activeUsersThisMonth === 1 ? '' : 's'} ·{' '}
            {formatTokens(tokenStats.weekTotal)} en 7d
          </div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Engines con persona IA</div>
          <div className={`cc-mod-stat-v ${personas > 0 ? 'pu' : ''}`}>{personas}</div>
          <div className="cc-mod-stat-sub">
            {personas > 0
              ? engines
                  .filter((e) => e.persona)
                  .map((e) => e.name)
                  .join(' · ')
              : 'todavía no has entrenado ninguna'}
          </div>
        </div>
      </div>

      {/* Tokens consumed per engine, this calendar month. The query runs even
          when there's no data so the empty state is informative (vs. a missing
          section that looks like a bug). Lifetime total is rendered alongside
          so the admin can see "this is what we've spent ever vs. just this
          month". */}
      <div className="cc-mod-section">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div className="cc-mod-sl" style={{ marginBottom: 0 }}>
            Consumo de tokens · este mes
          </div>
          <small
            style={{
              fontFamily: 'var(--cc-mono), monospace',
              fontSize: 10.5,
              color: 'var(--cc-txt-4)',
              letterSpacing: '0.08em',
            }}
          >
            HISTÓRICO TOTAL · {formatTokens(tokenStats.allTimeTotal)}
          </small>
        </div>
        {tokenStats.byEngineThisMonth.length === 0 ? (
          <div
            style={{
              padding: '24px 22px',
              border: '1px dashed var(--cc-line-2)',
              borderRadius: 'var(--cc-r-l)',
              textAlign: 'center',
              color: 'var(--cc-txt-3)',
              fontSize: 13,
            }}
          >
            Ningún engine ha reportado tokens este mes todavía.
            <br />
            <span
              style={{
                color: 'var(--cc-txt-4)',
                fontSize: 11.5,
                fontFamily: 'var(--cc-mono), monospace',
                marginTop: 6,
                display: 'inline-block',
              }}
            >
              Cada engine envía datos a <code>/api/engines/[slug]/usage</code> en
              cada llamada al modelo que se completa bien.
            </span>
          </div>
        ) : (
          <div className="cc-mod-list">
            {tokenStats.byEngineThisMonth.map((row) => {
              // Pct of month total — visualized as a thin bar below the row.
              const pct =
                tokenStats.monthTotal > 0
                  ? Math.max(2, Math.round((row.tokens / tokenStats.monthTotal) * 100))
                  : 0;
              return (
                <div
                  key={row.engineId}
                  className="cc-mod-row"
                  style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}
                >
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                  >
                    <div className="cc-mod-ic">⌬</div>
                    <div className="cc-mod-body">
                      <div className="cc-mod-name">{row.engineName}</div>
                      <div className="cc-mod-sub">
                        slug: <code>{row.engineSlug}</code> · {row.activeUsers}{' '}
                        usuario{row.activeUsers === 1 ? '' : 's'} activo
                        {row.activeUsers === 1 ? '' : 's'} este mes
                      </div>
                    </div>
                    <div className="cc-mod-right">
                      <b className="cy">{formatTokens(row.tokens)}</b>
                      <span>
                        {tokenStats.monthTotal > 0
                          ? `${((row.tokens / tokenStats.monthTotal) * 100).toFixed(1)}% del total`
                          : '—'}
                      </span>
                    </div>
                  </div>
                  {/* Mini-bar showing share of the month — cyan to match the
                      "Tokens IA · mes" stat tile above. */}
                  <div
                    style={{
                      height: 4,
                      width: '100%',
                      background: 'var(--cc-bg-3)',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: 'var(--cc-cyan)',
                        opacity: 0.7,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="cc-mod-section">
        <div className="cc-mod-sl">Top engines · salud y estado</div>
        {topByHealth.length === 0 ? (
          <EmptyEngines />
        ) : (
          <div className="cc-mod-list">
            {topByHealth.map((e) => {
              const isComing = e.status === 'coming_soon';
              return (
                <div key={e.id} className="cc-mod-row">
                  <div className="cc-mod-ic">{e.icon}</div>
                  <div className="cc-mod-body">
                    <div className="cc-mod-name">
                      {e.name}{' '}
                      {isComing && (
                        <span
                          className="cc-mod-badge"
                          style={{
                            color: 'var(--cc-amber)',
                            borderColor: 'rgba(245,177,61,.3)',
                            background: 'var(--cc-amber-g)',
                          }}
                        >
                          Próximamente
                        </span>
                      )}
                    </div>
                    <div className="cc-mod-sub">
                      {e.type} · {e.region}
                      {e.node !== '—' && ` · ${e.node}`}
                    </div>
                  </div>
                  <div className="cc-mod-right">
                    <b className={e.revenueCents > 0 ? 'gr' : undefined}>
                      {e.revenueCents > 0
                        ? `$${Math.round(e.revenueCents / 100).toLocaleString()}`
                        : isComing
                          ? '—'
                          : '$0'}
                    </b>
                    <span>
                      {e.state === 'OFFLINE' ? 'offline' : `salud ${e.health}%`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="cc-mod-section">
        <div className="cc-mod-sl">Engines que necesitan tu atención</div>
        {needAttention.length === 0 ? (
          <div
            style={{
              padding: '32px 22px',
              border: '1px dashed var(--cc-line-2)',
              borderRadius: 'var(--cc-r-l)',
              textAlign: 'center',
              color: 'var(--cc-txt-3)',
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            ● <b style={{ color: 'var(--cc-green)' }}>Todo en orden</b> — ningún engine
            necesita que intervengas.
            <br />
            <span
              style={{
                color: 'var(--cc-txt-4)',
                fontSize: 11.5,
                fontFamily: 'var(--cc-mono), monospace',
                marginTop: 6,
                display: 'inline-block',
              }}
            >
              Si algo falla o se pone lento, te avisamos aquí.
            </span>
          </div>
        ) : (
          <div className="cc-mod-list">
            {needAttention.map((e) => (
              <div key={e.id} className="cc-mod-row">
                <div className="cc-mod-ic">{e.icon}</div>
                <div className="cc-mod-body">
                  <div className="cc-mod-name">
                    {e.name}{' '}
                    <span className={`cc-mod-badge ${e.stateCode === 'r' ? 'r' : 'am'}`}>
                      {e.stateCode === 'r' ? 'Error' : 'Degradado'}
                    </span>
                  </div>
                  <div className="cc-mod-sub">{e.description}</div>
                </div>
                <div className="cc-mod-right">
                  <b>{e.health}%</b>
                  <span>{e.latencyMs}ms</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyEngines() {
  return (
    <div
      style={{
        padding: '40px 22px',
        border: '1px dashed var(--cc-line-2)',
        borderRadius: 'var(--cc-r-l)',
        textAlign: 'center',
        color: 'var(--cc-txt-3)',
        fontSize: 13,
        lineHeight: 1.55,
      }}
    >
      Todavía no hay engines en el catálogo.
      <br />
      <span
        style={{
          color: 'var(--cc-txt-4)',
          fontSize: 11.5,
          fontFamily: 'var(--cc-mono), monospace',
          marginTop: 6,
          display: 'inline-block',
        }}
      >
        Si acabas de correr las migraciones, hay 2 activos (ChalybClip, ChalybStreamManager) y 4
        próximamente — los ves en{' '}
        <Link
          href={'/dashboard/engines' as Route}
          style={{ color: 'var(--cc-green)', textDecoration: 'underline' }}
        >
          /dashboard/engines
        </Link>
        .
      </span>
    </div>
  );
}
