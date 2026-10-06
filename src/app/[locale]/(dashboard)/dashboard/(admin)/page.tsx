import type { Metadata } from 'next';
import type { Route } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { requireAdminPage } from '@/lib/admin/guard';
import { commandKpis, netRevenue, monthWindow } from '@/lib/admin/kpis';
import { attentionItems } from '@/lib/admin/attention';
import { loadAttention, loadPayments, loadSubscriptions, loadToolHealth } from '@/lib/admin/data';
import { formatMxn, zonedStartOfDay } from '@/lib/billing/money';
import { KpiCard } from '@/components/dashboard/admin/kpi-card';
import { Pill } from '@/components/ui/primitives';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.home');
  return { title: t('metaTitle') };
}

// Centro de mando (SCR-27, P5-1). Every number comes from payments and
// subscriptions through src/lib/admin/kpis.ts; a delta on a near-zero base
// reads "sin datos suficientes".

const RANGES = ['hoy', '7d', 'mes'] as const;
type Range = (typeof RANGES)[number];

function greetingKey(now: Date): 'morning' | 'afternoon' | 'night' {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Mexico_City', hour: 'numeric', hourCycle: 'h23' }).format(now));
  return h < 12 ? 'morning' : h < 19 ? 'afternoon' : 'night';
}

export default async function CentroDeMando({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ rango?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminPage();
  const t = await getTranslations('admin');
  const { rango } = await searchParams;
  const range: Range = (RANGES as readonly string[]).includes(rango ?? '') ? (rango as Range) : 'mes';
  const now = new Date();

  const [pays, subs, tools] = await Promise.all([loadPayments(now), loadSubscriptions(), loadToolHealth(now)]);
  const attention = await loadAttention(subs.data, tools.data, now);
  const k = commandKpis(pays.data, subs.data, now);
  const window =
    range === 'mes'
      ? monthWindow(now)
      : { start: range === 'hoy' ? zonedStartOfDay(now) : new Date(zonedStartOfDay(now).getTime() - 6 * 86_400_000), end: new Date(now.getTime() + 1) };
  const revenue = range === 'mes' ? k.revenue : netRevenue(pays.data, window);
  const moneyFailed = pays.failed || subs.failed;
  const pct = (d: number) => `${d > 0 ? '+' : ''}${Math.round(d * 100)}%`;
  const items = attention.data ? attentionItems(attention.data) : [];

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      <header style={{ display: 'grid', gap: 6 }}>
        <p className="ch-eyebrow">{t(`hello.${greetingKey(now)}`)}</p>
        <h1 className="ch-h1">{t('home.title')}</h1>
        <p className="ch-sub">{t('home.sub')}</p>
        <nav aria-label={t('home.range')} className="ch-seg" style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {RANGES.map((r) => (
            <Link
              key={r}
              href={(r === 'mes' ? '/dashboard' : `/dashboard?rango=${r}`) as Route}
              aria-current={range === r ? 'page' : undefined}
              className={`ch-chip${range === r ? ' ch-chip--on' : ''}`}
            >
              {t(r === 'hoy' ? 'home.today' : r === '7d' ? 'home.week' : 'home.month')}
            </Link>
          ))}
        </nav>
      </header>

      {moneyFailed && <p role="alert" className="ch-card" style={{ padding: 16 }}>{t('home.loadFailed')}</p>}

      <div className="ch-kpis">
        <KpiCard
          label={t(range === 'hoy' ? 'home.revenueToday' : range === '7d' ? 'home.revenueWeek' : 'home.revenue')}
          value={moneyFailed ? null : formatMxn(revenue.netCents)}
          sub={
            range !== 'mes'
              ? t('home.revenueSub')
              : k.revenueDelta === null
                ? `${t('home.revenueSub')} · ${t('home.noBase')}`
                : t('home.vsLast', { delta: pct(k.revenueDelta) })
          }
          trend={range === 'mes' && k.revenueDelta !== null ? (k.revenueDelta >= 0 ? 'up' : 'down') : null}
        />
        <KpiCard label={t('home.subscribers')} value={subs.failed ? null : String(k.subscribers)} sub={t('home.subscribersSub', { n: k.subscribersNew })} />
        <KpiCard label={t('home.trials')} value={subs.failed ? null : String(k.trials)} sub={t('home.trialsSub', { n: k.trialsEndingThisWeek })} />
        <KpiCard
          label={t('home.conversion')}
          value={moneyFailed || k.conversionOf10 === null ? null : `${k.conversionOf10}/10`}
          sub={k.conversionOf10 === null ? t('home.conversionNone', { n: k.trialsFinished }) : t('home.conversionSub', { n: k.conversionOf10 })}
        />
      </div>

      <section className="ch-section" aria-labelledby="attn-t">
        <h2 id="attn-t">
          {t('home.attention')} {items.length > 0 && <Pill kind="bad">{items.reduce((a, i) => a + i.n, 0)}</Pill>}
        </h2>
        {attention.failed ? (
          <p className="ch-card" style={{ padding: 16 }}>{t('home.loadFailed')}</p>
        ) : items.length === 0 ? (
          <p className="ch-card" style={{ padding: 16 }}>{t('home.attentionNone')}</p>
        ) : (
          <ul className="ch-group ch-attn">
            {items.map((i) => (
              <li key={i.key} className="ch-row">
                <span className="ch-row__tx">
                  <b>{t(`home.att.${i.key}`, { n: i.n })}</b>
                </span>
                <Link href={i.href as Route} className="ch-btn ch-btn--secondary ch-btn--compact">
                  {t(`home.att.cta.${i.key}`)}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ch-section" aria-labelledby="tools-t">
        <h2 id="tools-t">{t('home.tools')}</h2>
        {tools.failed ? (
          <p className="ch-card" style={{ padding: 16 }}>{t('home.loadFailed')}</p>
        ) : (
          <ul className="ch-group" style={{ listStyle: 'none', margin: 0 }}>
            {tools.data
              .filter((x) => x.status === 'active')
              .map((x) => (
                <li key={x.slug} className="ch-row">
                  <span className="ch-row__tx">
                    <b>
                      {x.name} <span className="ch-muted">({x.slug})</span>
                    </b>
                  </span>
                  <Pill kind={x.health === 'ok' ? 'ok' : x.health === 'slow' ? 'warn' : 'bad'}>{t(`home.health.${x.health}`)}</Pill>
                  <Link href={`/dashboard/actividad?herramienta=${x.slug}` as Route} className="ch-lnk">
                    {t('home.seeActivity')}
                  </Link>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
