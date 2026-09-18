// /dashboard/revenue — "Ingresos por engine". A SUB-VIEW of Dinero
// (/dashboard/billing), not a peer of it in the nav.
//
// WHAT THIS PAGE USED TO CLAIM, AND WHY NONE OF IT WAS TRUE
//
//   "Lo que ganaste hoy · $0 · +12% más que ayer"
//        The figure was SUM(engine_health.revenue_cents), a column seeded to
//        0 by migration 0010 and never written since — so it was always $0,
//        it had nothing to do with today, and it contradicted the "Ingresos
//        hoy $10" in the strip above it. The "+12%" was a string. There is
//        no yesterday number anywhere in this system to compare against.
//   "Ingreso mensual estimado"  the same dead column, multiplied by 30.
//   "Lo que te costó la IA hoy · $84.20 · te queda 99.2% de margen"
//        Both literals, hardcoded.
//
// What replaces them: the shared money helper for the figures that are real
// (what actually came in today and this month, from `payments`), real token
// consumption per engine, and an explicit "no conectado" for per-engine
// revenue — because payments carry no engine_id, so attributing revenue to
// an engine is not something this system can do yet. Saying so is worth more
// than a confident zero.

import { setRequestLocale } from 'next-intl/server';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import { listEngines } from '@/lib/data/engines';
import { getPlatformTokenStats } from '@/lib/usage/platform-stats';
import { PLATFORM_TIMEZONE, formatMxn } from '@/lib/billing/money';
import { getMoneyThisMonth, getMoneyToday } from '@/lib/billing/money-data';

export const metadata = { title: 'Ingresos por engine' };

function formatTokens(n: number): string {
  if (n === 0) return '0';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString('es-MX');
}

export default async function RevenuePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [engines, tokenStats, today, month] = await Promise.all([
    listEngines(),
    getPlatformTokenStats(),
    getMoneyToday(),
    getMoneyThisMonth(),
  ]);

  const liveEngines = engines.filter((e) => e.status === 'active');

  return (
    <div className="cc-scroll">
      <div className="cc-mod-statgrid">
        {/* Identical to the strip and to Dinero — one helper, one number. */}
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Dinero hoy</div>
          <div className={`cc-mod-stat-v ${today.count > 0 ? 'gr' : ''}`}>
            {today.failed ? '—' : formatMxn(today.totalMxnCents)}
          </div>
          <div className="cc-mod-stat-sub">
            {today.failed
              ? 'sin datos'
              : today.count === 0
                ? `sin cobros hoy · ${today.dayKey} (${PLATFORM_TIMEZONE})`
                : `${today.count} cobro${today.count === 1 ? '' : 's'} · ${today.dayKey}`}
          </div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Este mes</div>
          <div className={`cc-mod-stat-v ${month.totalMxnCents > 0 ? 'gr' : ''}`}>
            {month.failed ? '—' : formatMxn(month.totalMxnCents)}
          </div>
          <div className="cc-mod-stat-sub">
            {month.failed
              ? 'sin datos'
              : month.count === 0
                ? 'todavía sin cobros este mes'
                : `${month.count} pago${month.count === 1 ? '' : 's'} aprobado${month.count === 1 ? '' : 's'}`}
          </div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Engines en vivo</div>
          <div className={`cc-mod-stat-v ${liveEngines.length > 0 ? 'cy' : ''}`}>
            {liveEngines.length}
            <small>/ {engines.length}</small>
          </div>
          <div className="cc-mod-stat-sub">el resto sigue en catálogo</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Tokens IA · mes</div>
          <div className={`cc-mod-stat-v ${tokenStats.monthTotal > 0 ? 'cy' : ''}`}>
            {formatTokens(tokenStats.monthTotal)}
          </div>
          <div className="cc-mod-stat-sub">
            {tokenStats.activeUsersThisMonth} usuario
            {tokenStats.activeUsersThisMonth === 1 ? '' : 's'} activo
            {tokenStats.activeUsersThisMonth === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {/* ── Per-engine revenue: honestly not available ────────────────── */}
      <div className="cc-mod-section">
        <div className="cc-mod-sl">Ingreso atribuido a cada engine</div>
        <div className="cc-mod-empty-note">
          No conectado — un pago no dice a qué engine pertenece.
          <br />
          <small>
            Para partirlo por engine hace falta una columna <code>engine_id</code> en{' '}
            <code>payments</code> (o mapear plan → engines incluidos) y escribirla desde el
            checkout. Mientras tanto, el ingreso vive completo en Dinero.
          </small>
        </div>
      </div>

      {/* ── What IS measured per engine: consumption ──────────────────── */}
      <div className="cc-mod-section">
        <div className="cc-mod-sl">Consumo de IA por engine · este mes</div>
        {tokenStats.byEngineThisMonth.length === 0 ? (
          <div className="cc-mod-empty-note">
            Sin datos — ningún engine ha reportado tokens este mes.
            <br />
            <small>
              Cada engine reporta en <code>/api/engines/[slug]/usage</code> al terminar una llamada
              al modelo.
            </small>
          </div>
        ) : (
          <div className="cc-mod-list">
            {tokenStats.byEngineThisMonth.map((row) => {
              const pct =
                tokenStats.monthTotal > 0 ? (row.tokens / tokenStats.monthTotal) * 100 : 0;
              return (
                <div key={row.engineId} className="cc-mod-row">
                  <div className="cc-mod-ic">⌬</div>
                  <div className="cc-mod-body">
                    <div className="cc-mod-name">{row.engineName}</div>
                    <div
                      className="cc-mod-sub"
                      style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}
                    >
                      <span>{pct.toFixed(1)}%</span>
                      <span className="cc-bar-track">
                        <span className="cc-bar-fill cy" style={{ width: `${pct}%` }} />
                      </span>
                    </div>
                  </div>
                  <div className="cc-mod-right">
                    <b className="cy">{formatTokens(row.tokens)}</b>
                    <span>
                      {row.activeUsers} usuario{row.activeUsers === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="cc-mod-section">
        <p style={{ fontSize: 12.5 }}>
          <Link
            href={'/dashboard/billing' as Route}
            style={{ color: 'var(--cc-green)', textDecoration: 'underline' }}
          >
            ← Volver a Dinero · P&amp;L, pagos y royalties
          </Link>
        </p>
      </div>
    </div>
  );
}
