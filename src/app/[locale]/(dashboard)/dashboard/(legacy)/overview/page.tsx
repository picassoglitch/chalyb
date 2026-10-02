// /dashboard — "Centro de mando". Health, incidents, and the engine list.
//
// This page is Overview and Operaciones merged. They were two nav items
// showing the same engines: Overview counted them and listed the top six by
// health, Operaciones listed all of them grouped by category. An operator
// opening the command center had to pick which of the two was the real one.
//
// What survived the merge is what answers "¿qué se rompió?" and "¿qué está
// vivo?": a health summary, the engines that need attention, and the
// operator list. What did not: the "Ingresos mes" card that summed
// engine_health.revenue_cents (a column seeded to 0 and never written, so
// always $0 — right next to a top bar showing today's real money), and the
// "Top engines · salud y estado" list, which repeated six of the engines
// already listed below it.

import { setRequestLocale } from 'next-intl/server';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import { OperatorSurface, Toolbar } from '@/components/dashboard/operator-rows';
import { listEngines } from '@/lib/data/engines';
import { getPlatformTokenStats } from '@/lib/usage/platform-stats';
import { formatMxn } from '@/lib/billing/money';
import { getMoneyThisMonth } from '@/lib/billing/money-data';

export const metadata = { title: 'Centro de mando' };

function formatTokens(n: number): string {
  if (n === 0) return '0';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString('es-MX');
}

export default async function CommandCenterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [engines, tokenStats, month] = await Promise.all([
    listEngines(),
    getPlatformTokenStats().catch((err) => {
      console.error('[/dashboard] token stats failed:', err);
      return null;
    }),
    getMoneyThisMonth(),
  ]);

  // The SAME definition of "vivo" the sidebar badge and the metric strip
  // use: engines.status = 'active'. There is one catalogue count in this
  // product now, not three.
  const live = engines.filter((e) => e.status === 'active').length;
  const errored = engines.filter((e) => e.stateCode === 'r').length;
  const comingSoon = engines.filter((e) => e.status === 'coming_soon').length;
  const needAttention = engines.filter((e) => e.stateCode === 'r' || e.stateCode === 'a');

  return (
    <>
      <div className="cc-mod-statgrid" style={{ padding: '18px 26px 0' }}>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Engines vivos</div>
          <div className={`cc-mod-stat-v ${live > 0 ? 'gr' : ''}`}>
            {live}
            <small>/ {engines.length}</small>
          </div>
          <div className="cc-mod-stat-sub">
            {comingSoon} próximamente · {errored} con errores
          </div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Incidentes abiertos</div>
          <div
            className="cc-mod-stat-v"
            style={needAttention.length > 0 ? { color: 'var(--cc-red)' } : undefined}
          >
            {needAttention.length}
          </div>
          <div className="cc-mod-stat-sub">
            {needAttention.length === 0
              ? 'ningún engine necesita que intervengas'
              : 'con error o degradados — abajo'}
          </div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Dinero del mes</div>
          <div className={`cc-mod-stat-v ${month.totalMxnCents > 0 ? 'gr' : ''}`}>
            {month.failed ? '—' : formatMxn(month.totalMxnCents)}
          </div>
          <div className="cc-mod-stat-sub">
            {month.failed ? (
              'sin datos'
            ) : (
              <Link href={'/dashboard/billing' as Route} style={{ color: 'var(--cc-txt-3)' }}>
                {month.count} pago{month.count === 1 ? '' : 's'} · ver Dinero →
              </Link>
            )}
          </div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Tokens IA · mes</div>
          <div className={`cc-mod-stat-v ${(tokenStats?.monthTotal ?? 0) > 0 ? 'cy' : ''}`}>
            {tokenStats ? formatTokens(tokenStats.monthTotal) : '—'}
          </div>
          <div className="cc-mod-stat-sub">
            {!tokenStats
              ? 'sin datos'
              : `${tokenStats.activeUsersThisMonth} usuario${
                  tokenStats.activeUsersThisMonth === 1 ? '' : 's'
                } activo${tokenStats.activeUsersThisMonth === 1 ? '' : 's'}`}
          </div>
        </div>
      </div>

      {/* Incidents first: this is the "action now" half of the page. */}
      {needAttention.length > 0 && (
        <div className="cc-mod-section" style={{ padding: '0 26px' }}>
          <div className="cc-mod-sl">Necesitan tu atención</div>
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
                  <span>{e.latencyMs > 0 ? `${e.latencyMs}ms` : 'sin medición'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Toolbar />
      <div className="cc-scroll">
        <OperatorSurface />
      </div>
    </>
  );
}
