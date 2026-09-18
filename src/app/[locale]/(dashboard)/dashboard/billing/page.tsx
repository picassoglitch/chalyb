// /dashboard/billing — "Dinero". The single money hub.
//
// Everything about money on the operator side answers here: what came in
// today, what came in this month, what it costs to run, what's left, who
// paid, and what we owe partners. Royalties and per-engine revenue are
// sub-views linked from this page, not peers of it in the nav — an operator
// asking "¿nos pagaron?" should not have to guess between three tabs.
//
// Every peso on this page comes from lib/billing/money-data.ts, the same
// helper the top metric strip and the AI rail read. That is the whole point:
// before, this page summed its own last-100 rows over a server-local month
// while the strip summed a UTC day, and one $10 charge showed as $10 up top
// and $0 here.

import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { getTokenPack } from '@/lib/payments/pricing';
import { FX_MANUAL_NOTE, PLATFORM_TIMEZONE, formatMxn, toMxnCents } from '@/lib/billing/money';
import {
  getMoneyThisMonth,
  getMoneyToday,
  getPayingCustomersThisMonth,
} from '@/lib/billing/money-data';
import { loadPayments, paymentKind, type PaymentLedgerRow } from '@/lib/billing/payments-data';
import { MONTHLY_OPERATING_COSTS, MP_EFFECTIVE_FEE_RATE } from '@/lib/billing/operating-costs';
import { getCurrentPeriodAccruals } from '@/lib/usage/royalties';

export const metadata = { title: 'Dinero' };

// Format an ISO date as "17 may" — short list-display.
function shortDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US', {
    day: '2-digit',
    month: 'short',
  });
}

/** What a ledger row bought, for the operator's list. */
function describe(p: PaymentLedgerRow): string {
  const kind = paymentKind(p);
  if (kind === 'pack') {
    const tokens = p.tokens_granted ?? (p.pack_id ? getTokenPack(p.pack_id)?.tokens : null);
    return tokens ? `Tokens · +${tokens.toLocaleString('es-MX')}` : 'Tokens · pack';
  }
  if (kind === 'subscription') return `Plan ${p.tier} · mensual`;
  return `Plan ${p.tier}`;
}

export default async function AdminMoneyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Defensive role-gate — parent dashboard layout already redirects non-admins,
  // but the financial data here is sensitive enough to double-check.
  const session = await getSessionUser();
  if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN')) {
    redirect('/app');
  }

  const [today, month, customers, ledger, royalties] = await Promise.all([
    getMoneyToday(),
    getMoneyThisMonth(),
    getPayingCustomersThisMonth(),
    loadPayments({ limit: 100, logTag: '/dashboard/billing' }),
    getCurrentPeriodAccruals().catch((err) => {
      console.error('[/dashboard/billing] royalties lookup failed:', err);
      return null;
    }),
  ]);

  const payments = ledger.rows;

  // ── Costs ────────────────────────────────────────────────────────────
  const mpFeesMxnCents = Math.round(month.totalMxnCents * MP_EFFECTIVE_FEE_RATE);
  const operatingCosts = MONTHLY_OPERATING_COSTS.map((c) =>
    c.id === 'mp_fees' ? { ...c, amountCents: mpFeesMxnCents, currency: 'MXN' as const } : c,
  );
  const totalCostMxnCents = operatingCosts.reduce(
    (sum, c) => sum + toMxnCents(c.amountCents, c.currency),
    0,
  );

  const netMxnCents = month.totalMxnCents - totalCostMxnCents;
  const marginPct = month.totalMxnCents > 0 ? (netMxnCents / month.totalMxnCents) * 100 : 0;

  // Any conversion anywhere on this page means the manual rate was used, and
  // the page has to say so rather than presenting an estimate as a fact.
  const anyFx =
    today.usedManualFx ||
    month.usedManualFx ||
    operatingCosts.some((c) => c.currency !== 'MXN' && c.amountCents !== 0);

  const monthLabel = new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  const payingCount = new Set([...customers.planUserIds, ...customers.packUserIds]).size;
  const accruableCents = royalties
    ? royalties.accruals
        .filter((a) => !a.alreadyFinalized)
        .reduce((sum, a) => sum + a.accruedCents, 0)
    : 0;

  return (
    <div className="cc-scroll">
      <div className="cc-mod-statgrid">
        {/* THE number. Identical to the one in the top strip, by construction. */}
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Dinero hoy</div>
          <div className={`cc-mod-stat-v ${today.count > 0 ? 'gr' : ''}`}>
            {today.failed ? '—' : formatMxn(today.totalMxnCents)}
          </div>
          <div className="cc-mod-stat-sub">
            {today.failed
              ? 'sin datos · la consulta falló'
              : today.count === 0
                ? `sin cobros hoy · ${today.dayKey} (${PLATFORM_TIMEZONE})`
                : `${today.count} cobro${today.count === 1 ? '' : 's'} · ${today.dayKey} (${PLATFORM_TIMEZONE})`}
          </div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Ingresos brutos · {monthLabel}</div>
          <div className={`cc-mod-stat-v ${month.totalMxnCents > 0 ? 'gr' : ''}`}>
            {month.failed ? '—' : formatMxn(month.totalMxnCents)}
          </div>
          <div className="cc-mod-stat-sub">
            {month.failed
              ? 'sin datos'
              : `${month.count} pago${month.count === 1 ? '' : 's'} · ${payingCount} cliente${payingCount === 1 ? '' : 's'}`}
          </div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Lo que cuesta operar</div>
          <div className={`cc-mod-stat-v ${totalCostMxnCents > 0 ? 'am' : ''}`}>
            {formatMxn(totalCostMxnCents)}
          </div>
          <div className="cc-mod-stat-sub">infra · IA · email · comisiones MP</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Margen neto</div>
          <div
            className={`cc-mod-stat-v ${netMxnCents > 0 ? 'gr' : ''}`}
            style={netMxnCents < 0 ? { color: 'var(--cc-red)' } : undefined}
          >
            {netMxnCents >= 0 ? formatMxn(netMxnCents) : `-${formatMxn(-netMxnCents)}`}
          </div>
          <div className="cc-mod-stat-sub">
            {month.totalMxnCents > 0
              ? `${marginPct.toFixed(1)}% de margen sobre lo bruto`
              : 'todavía no hay ingresos'}
          </div>
        </div>
      </div>

      {anyFx && (
        <p
          style={{
            fontSize: 11.5,
            color: 'var(--cc-amber)',
            fontFamily: 'var(--cc-mono), monospace',
            margin: '-6px 0 18px',
            paddingLeft: 4,
          }}
        >
          ▸ {FX_MANUAL_NOTE}
        </p>
      )}

      {/* ── Who pays ─────────────────────────────────────────────────── */}
      <div className="cc-mod-section">
        <div className="cc-mod-sl">Clientes que pagan · {monthLabel}</div>
        <div className="cc-mod-list">
          <div className="cc-mod-row">
            <div className="cc-mod-body">
              <div className="cc-mod-name">Planes</div>
              <div className="cc-mod-sub">
                {customers.pro} Pro · {customers.vip} VIP
              </div>
            </div>
            <div className="cc-mod-right">
              <b className={customers.planUserIds.length > 0 ? 'gr' : undefined}>
                {customers.planUserIds.length}
              </b>
              <span>suscriptores</span>
            </div>
          </div>
          <div className="cc-mod-row">
            <div className="cc-mod-body">
              <div className="cc-mod-name">Tokens extra</div>
              <div className="cc-mod-sub">
                compras de tokens — no cambian el plan de quien las hace
              </div>
            </div>
            <div className="cc-mod-right">
              <b className={customers.packUserIds.length > 0 ? 'cy' : undefined}>
                {customers.packUserIds.length}
              </b>
              <span>compradores</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Operating costs breakdown ────────────────────────────────── */}
      <div className="cc-mod-section">
        <div className="cc-mod-sl">Lo que cuesta operar · estimado al mes</div>
        <div className="cc-mod-list">
          {operatingCosts.map((c) => (
            <div key={c.id} className="cc-mod-row">
              <div className="cc-mod-body">
                <div className="cc-mod-name">
                  {c.provider}{' '}
                  <span
                    className="cc-mod-badge"
                    style={{
                      fontFamily: 'var(--cc-mono), monospace',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {c.currency}
                  </span>
                </div>
                <div className="cc-mod-sub">
                  {c.label} · {c.note}
                </div>
              </div>
              <div className="cc-mod-right">
                <b style={{ color: 'var(--cc-amber)' }}>
                  -
                  {c.currency === 'MXN'
                    ? formatMxn(c.amountCents)
                    : `$${(c.amountCents / 100).toFixed(2)} USD`}
                </b>
                <span>
                  {c.currency === 'MXN'
                    ? 'MXN'
                    : `≈ ${formatMxn(toMxnCents(c.amountCents, c.currency))} MXN · FX manual`}
                </span>
              </div>
            </div>
          ))}
        </div>
        <p
          style={{
            fontSize: 11.5,
            color: 'var(--cc-txt-4)',
            fontFamily: 'var(--cc-mono), monospace',
            marginTop: 10,
            paddingLeft: 4,
            lineHeight: 1.5,
          }}
        >
          ▸ Estos montos están puestos a mano. Para verlos en tiempo real hace falta una tarea
          automática que traiga el cobro de cada proveedor y lo guarde en{' '}
          <code>platform_costs</code>. Las comisiones de MP sí se calculan solas, sobre los ingresos
          del mes.
        </p>
      </div>

      {/* ── Royalties — a section here, not a top-level nav item ─────── */}
      <div className="cc-mod-section">
        <div className="cc-mod-sl">Royalties a socios · mes en curso</div>
        {!royalties ? (
          <div className="cc-mod-empty-note">
            Sin datos — no pudimos leer los accruals de royalties.
          </div>
        ) : (
          <div className="cc-mod-list">
            <div className="cc-mod-row">
              <div className="cc-mod-body">
                <div className="cc-mod-name">Por pagar este mes</div>
                <div className="cc-mod-sub">
                  {royalties.partnersWithAccrual} socio
                  {royalties.partnersWithAccrual === 1 ? '' : 's'} con saldo a favor
                </div>
              </div>
              <div className="cc-mod-right">
                <b className={accruableCents > 0 ? 'am' : undefined}>{formatMxn(accruableCents)}</b>
                <span>MXN</span>
              </div>
            </div>
          </div>
        )}
        <p style={{ marginTop: 10, paddingLeft: 4, fontSize: 12.5 }}>
          <Link
            href={'/dashboard/royalties' as Route}
            style={{ color: 'var(--cc-green)', textDecoration: 'underline' }}
          >
            Abrir royalties · cerrar periodo y registrar pagos →
          </Link>
        </p>
      </div>

      {/* ── Payments received ─────────────────────────────────────────── */}
      <div className="cc-mod-section">
        <div className="cc-mod-sl">Pagos recibidos · los últimos 100</div>
        {ledger.failure && (
          <div
            style={{
              padding: '12px 16px',
              border: '1px solid var(--cc-red)',
              background: 'rgba(233,84,84,.08)',
              borderRadius: 'var(--cc-r-l)',
              marginBottom: 12,
              color: 'var(--cc-txt-2)',
              fontSize: 12.5,
            }}
          >
            ● <b style={{ color: 'var(--cc-red)' }}>La lista no se pudo leer</b> — esto no quiere
            decir que no haya pagos. Revisa los logs de la función; el detalle está ahí.
          </div>
        )}
        {payments.length === 0 ? (
          <div
            style={{
              padding: '32px 22px',
              border: '1px dashed var(--cc-line-2)',
              borderRadius: 'var(--cc-r-l)',
              textAlign: 'center',
              color: 'var(--cc-txt-3)',
              fontSize: 13,
            }}
          >
            {ledger.failure ? 'Sin datos.' : 'Todavía no hay pagos registrados.'}
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
              Aparecen solos cuando MP confirma un cobro a un cliente.
            </span>
          </div>
        ) : (
          <div className="cc-mod-list">
            {payments.slice(0, 30).map((p) => {
              const isApproved = p.status === 'approved';
              return (
                <div key={p.id} className="cc-mod-row">
                  <div className="cc-mod-body">
                    <div className="cc-mod-name">
                      {describe(p)}{' '}
                      <span className={`cc-mod-badge ${isApproved ? 'gr' : 'am'}`}>{p.status}</span>
                    </div>
                    <div className="cc-mod-sub">
                      {shortDate(p.created_at, locale)} · user <code>{p.user_id.slice(0, 8)}…</code>
                    </div>
                  </div>
                  <div className="cc-mod-right">
                    <b className={isApproved ? 'gr' : undefined}>{formatMxn(p.amount_cents)}</b>
                    <span>{p.currency}</span>
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
            href={'/dashboard/revenue' as Route}
            style={{ color: 'var(--cc-green)', textDecoration: 'underline' }}
          >
            Ver ingresos por engine →
          </Link>
        </p>
      </div>
    </div>
  );
}
