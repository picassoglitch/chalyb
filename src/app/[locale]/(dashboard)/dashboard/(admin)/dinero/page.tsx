import type { Metadata } from 'next';
import type { Route } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { requireAdminPage } from '@/lib/admin/guard';
import { loadPayments, loadPeople, loadSubscriptions } from '@/lib/admin/data';
import { moneyPage, monthWindow, movementState, type MovementState } from '@/lib/admin/kpis';
import { personStatus } from '@/lib/admin/people';
import { formatMxn, FX_MANUAL_NOTE } from '@/lib/billing/money';
import { MONTHLY_OPERATING_COSTS } from '@/lib/billing/operating-costs';
import { PLAN_KEYS } from '@/lib/billing/api';
import type { PlanKey } from '@/config/pricing';
import { KpiCard } from '@/components/dashboard/admin/kpi-card';
import { ExampleTag, Pill } from '@/components/ui/primitives';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.money');
  return { title: t('metaTitle') };
}

// Dinero (SCR-29, P5-3). Source: the `payments` ledger Mercado Pago's
// webhooks and the hourly reconcile write (docs/payments/money-truth.md);
// never users' plans. Main's Pagos / Suscripciones / Costos views fold in
// below, in that order.

const PILL: Record<MovementState, 'ok' | 'bad' | 'gray' | 'warn'> = {
  charged: 'ok',
  failed: 'bad',
  refunded: 'gray',
  pending: 'warn',
};

export default async function DineroPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ estado?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminPage();
  const t = await getTranslations('admin');
  const { estado } = await searchParams;
  const now = new Date();
  const [pays, subs, people] = await Promise.all([
    loadPayments(now),
    loadSubscriptions(),
    loadPeople(now),
  ]);
  const failed = pays.failed || subs.failed;
  const m = moneyPage(pays.data, subs.data, now);
  const month = monthWindow(now);
  const emails = new Map(people.data.people.map((p) => [p.id, p.name || p.email]));
  const movements = pays.data
    .filter((p) => Date.parse(p.created_at) >= month.start.getTime())
    .map((p) => ({ ...p, state: movementState(p) }))
    .filter((p) => !estado || p.state === estado);
  const max = Math.max(1, ...m.byMonth.map((b) => b.netCents));
  const fmtMonth = (iso: string) =>
    new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', {
      month: 'short',
      timeZone: 'America/Mexico_City',
    }).format(new Date(iso));
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Mexico_City',
    }).format(new Date(iso));
  const t2 = now.getTime();
  const subsBy = { active: 0, trial: 0, past_due: 0, cancelled: 0 };
  for (const s of subs.data) {
    const st = personStatus(s, t2);
    if (st === 'active') subsBy.active++;
    else if (st === 'trial') subsBy.trial++;
    else if (st === 'past_due') subsBy.past_due++;
    else subsBy.cancelled++;
  }
  const funnelMax = Math.max(1, m.funnel.started);

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      <header style={{ display: 'grid', gap: 6 }}>
        <h1 className="ch-h1">{t('money.title')}</h1>
        <p className="ch-sub">{t('money.sub')}</p>
        <p className="ch-muted">
          {t('money.source')} · {t('money.iva')}
        </p>
      </header>
      {failed && (
        <p role="alert" className="ch-card" style={{ padding: 16 }}>
          {t('home.loadFailed')}
        </p>
      )}

      <div className="ch-kpis">
        <KpiCard
          label={t('money.revenue')}
          value={failed ? null : formatMxn(m.revenue.netCents)}
          sub={
            m.revenue.usedManualFx
              ? `${t('money.revenueSub')} · ${FX_MANUAL_NOTE}`
              : t('money.revenueSub')
          }
        />
        <KpiCard
          label={t('money.trials')}
          value={failed ? null : `${m.trialsPaid}`}
          sub={t('money.trialsSub', { a: m.trialsPaid, b: m.trialsFinished })}
        />
        <KpiCard
          label={t('money.failed')}
          value={failed ? null : String(m.failedCharges)}
          sub={t('money.failedSub', { n: m.failedCharges })}
        />
        <KpiCard
          label={t('money.refunds')}
          value={failed ? null : String(m.refunds)}
          sub={t('money.refundsSub', { n: m.refunds })}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gap: 18,
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
        }}
      >
        <section className="ch-card ch-section" style={{ padding: 20 }} aria-labelledby="chart-t">
          <h2 id="chart-t">{t('money.chart')}</h2>
          <ol className="ch-bars" style={{ margin: 0 }}>
            {m.byMonth.map((b) => (
              <li
                key={b.start}
                aria-label={t('money.chartAria', {
                  mes: fmtMonth(b.start),
                  monto: formatMxn(b.netCents),
                })}
              >
                <span
                  className="ch-bars__bar"
                  style={{ height: `${Math.max(0, (b.netCents / max) * 100)}%` }}
                />
                <span aria-hidden="true">{fmtMonth(b.start)}</span>
              </li>
            ))}
          </ol>
        </section>
        <section className="ch-card ch-section" style={{ padding: 20 }} aria-labelledby="funnel-t">
          <h2 id="funnel-t">{t('money.funnel')}</h2>
          <ol className="ch-funnel">
            {(['started', 'stillTrial', 'paid', 'cancelled'] as const).map((k) => (
              <li key={k}>
                <span>{t(`money.funnelSteps.${k}`)}</span>
                <span className="ch-funnel__bar" aria-hidden="true">
                  <span style={{ width: `${(m.funnel[k] / funnelMax) * 100}%` }} />
                </span>
                <b>{m.funnel[k]}</b>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="ch-section" aria-labelledby="pay-t">
        <h2 id="pay-t">{t('money.payments')}</h2>
        <div
          role="group"
          aria-label={t('money.col.state')}
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
        >
          {([null, 'charged', 'failed', 'refunded', 'pending'] as const).map((s) => (
            <Link
              key={s ?? 'all'}
              href={(s ? `/dashboard/dinero?estado=${s}` : '/dashboard/dinero') as Route}
              aria-current={(estado ?? null) === s ? 'page' : undefined}
              className={`ch-chip${(estado ?? null) === s ? ' ch-chip--on' : ''}`}
            >
              {s ? t(`money.state.${s}`) : t('activity.all')}
            </Link>
          ))}
        </div>
        {movements.length === 0 ? (
          <p className="ch-card" style={{ padding: 16 }}>
            {t('money.noMovements')}
          </p>
        ) : (
          <div className="ch-table-wrap" role="region" aria-labelledby="pay-t" tabIndex={0}>
            <table className="ch-table">
              <thead>
                <tr>
                  <th scope="col">{t('money.col.date')}</th>
                  <th scope="col">{t('money.col.person')}</th>
                  <th scope="col">{t('money.col.concept')}</th>
                  <th scope="col" className="num">
                    {t('money.col.amount')}
                  </th>
                  <th scope="col">{t('money.col.state')}</th>
                </tr>
              </thead>
              <tbody>
                {movements.slice(0, 200).map((p) => (
                  <tr key={p.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(p.created_at)}</td>
                    <td>{(p.user_id && emails.get(p.user_id)) || '—'}</td>
                    <td>
                      {p.plan_key && (PLAN_KEYS as readonly string[]).includes(p.plan_key)
                        ? t(`settings.plan.${p.plan_key as PlanKey}`)
                        : (p.kind ?? '—')}
                    </td>
                    <td className="num">{formatMxn(p.amount_cents ?? 0)}</td>
                    <td>
                      <Pill kind={PILL[p.state]}>{t(`money.state.${p.state}`)}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="ch-section" aria-labelledby="subs-t">
        <h2 id="subs-t">{t('money.subscriptions')}</h2>
        <div className="ch-kpis">
          {(['active', 'trial', 'past_due', 'cancelled'] as const).map((k) => (
            <KpiCard
              key={k}
              label={t(`money.subsBy.${k}`)}
              value={subs.failed ? null : String(subsBy[k])}
            />
          ))}
        </div>
      </section>

      <section className="ch-section" aria-labelledby="costs-t">
        <h2 id="costs-t">
          {t('money.costs')} <ExampleTag>{t('example')}</ExampleTag>
        </h2>
        <p className="ch-muted">{t('money.costsNote')}</p>
        <div className="ch-table-wrap" role="region" aria-labelledby="costs-t" tabIndex={0}>
          <table className="ch-table">
            <tbody>
              {MONTHLY_OPERATING_COSTS.map((c) => (
                <tr key={c.id}>
                  <td>
                    <b>{c.provider}</b>
                    <br />
                    <small className="ch-muted">{c.label}</small>
                  </td>
                  <td className="num">
                    {(c.amountCents / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 })}{' '}
                    {c.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
