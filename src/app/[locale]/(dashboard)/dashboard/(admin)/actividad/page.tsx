import type { Metadata } from 'next';
import type { Route } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { requireAdminPage } from '@/lib/admin/guard';
import { loadActivity, loadToolHealth } from '@/lib/admin/data';
import { mergeActivity, type ActivityType } from '@/lib/admin/activity';
import { Pill } from '@/components/ui/primitives';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.activity');
  return { title: t('metaTitle') };
}

// Actividad (P5-4): charges, failures, refunds, cancellations, notice
// bounces, consent events (type, person, time, folio — never the IP) and
// what the team did, newest first. Filter by type and tool (URL).

const TYPES: ActivityType[] = ['charge', 'failed', 'refund', 'cancel', 'notice', 'consent', 'admin', 'tool'];
const PILL: Record<ActivityType, 'ok' | 'bad' | 'gray' | 'warn' | 'acc' | 'dark'> = {
  charge: 'ok', failed: 'bad', refund: 'gray', cancel: 'gray', notice: 'warn', consent: 'acc', admin: 'dark', tool: 'warn',
};

export default async function ActividadPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tipo?: string; herramienta?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminPage();
  const t = await getTranslations('admin');
  const { tipo, herramienta } = await searchParams;
  const type = TYPES.includes(tipo as ActivityType) ? (tipo as ActivityType) : null;
  const [sources, tools] = await Promise.all([loadActivity(), loadToolHealth()]);
  const tool = tools.data.some((x) => x.slug === herramienta) ? herramienta! : null;
  const events = mergeActivity(sources.data, { type, tool });
  const href = (next: { tipo?: string | null; herramienta?: string | null }) => {
    const q = new URLSearchParams();
    const tp = next.tipo === undefined ? type : next.tipo;
    const hm = next.herramienta === undefined ? tool : next.herramienta;
    if (tp) q.set('tipo', tp);
    if (hm) q.set('herramienta', hm);
    const s = q.toString();
    return (s ? `/dashboard/actividad?${s}` : '/dashboard/actividad') as Route;
  };
  const time = (iso: string) =>
    new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Mexico_City' }).format(new Date(iso));

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <header>
        <h1 className="ch-h1">{t('activity.title')}</h1>
        <p className="ch-sub">{t('activity.sub')}</p>
      </header>
      <nav aria-label={t('activity.type')} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href={href({ tipo: null })} aria-current={!type ? 'page' : undefined} className={`ch-chip${!type ? ' ch-chip--on' : ''}`}>{t('activity.all')}</Link>
        {TYPES.map((x) => (
          <Link key={x} href={href({ tipo: x })} aria-current={type === x ? 'page' : undefined} className={`ch-chip${type === x ? ' ch-chip--on' : ''}`}>
            {t(`activity.types.${x}`)}
          </Link>
        ))}
      </nav>
      <nav aria-label={t('activity.tool')} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href={href({ herramienta: null })} aria-current={!tool ? 'page' : undefined} className={`ch-chip ch-chip--sm${!tool ? ' ch-chip--on' : ''}`}>{t('activity.all')}</Link>
        {tools.data.map((x) => (
          <Link key={x.slug} href={href({ herramienta: x.slug })} aria-current={tool === x.slug ? 'page' : undefined} className={`ch-chip ch-chip--sm${tool === x.slug ? ' ch-chip--on' : ''}`}>
            {x.name}
          </Link>
        ))}
      </nav>
      {sources.failed && <p role="alert" className="ch-card" style={{ padding: 16 }}>{t('home.loadFailed')}</p>}
      {events.length === 0 ? (
        <p className="ch-card" style={{ padding: 20 }}>{t('activity.empty')}</p>
      ) : (
        <ol className="ch-group" style={{ listStyle: 'none', margin: 0 }}>
          {events.map((e) => (
            <li key={e.id} className="ch-row" data-type={e.type}>
              <span className="ch-row__tx">
                <b>{e.title}</b>
                <small>
                  {[e.detail, e.who && t('activity.by', { quien: e.who }), time(e.at)].filter(Boolean).join(' · ')}
                </small>
              </span>
              <Pill kind={PILL[e.type]}>{t(`activity.types.${e.type}`)}</Pill>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
