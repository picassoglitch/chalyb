import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireAdminPage } from '@/lib/admin/guard';
import { loadToolHealth } from '@/lib/admin/data';
import { ToolSwitches } from '@/components/dashboard/admin/tool-switches';
import { toolBySlug } from '@/config/tools';
import { getToolStatus } from '@/lib/tools/status';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.tools');
  return { title: t('metaTitle') };
}

// Herramientas (P5-5). The switch writes engines.status, which every
// customer surface reads; main's technical engine settings stay at
// /dashboard/engines under "Más".

export default async function HerramientasAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminPage();
  const t = await getTranslations('admin');
  const { data, failed } = await loadToolHealth();
  // Incidents exist for the tools that open inside the app (WS-11).
  const incidents = Object.fromEntries(
    await Promise.all(
      data
        .filter((x) => toolBySlug(x.slug))
        .map(async (x) => [x.slug, (await getToolStatus(x.slug)).incidentActive] as const),
    ),
  );
  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <header>
        <h1 className="ch-h1">{t('tools.title')}</h1>
        <p className="ch-sub">{t('tools.sub')}</p>
      </header>
      {failed ? (
        <p role="alert" className="ch-card" style={{ padding: 16 }}>{t('home.loadFailed')}</p>
      ) : (
        <ToolSwitches
          tools={data.map((x) => ({ slug: x.slug, name: x.name, visible: x.status === 'active', health: x.health, failures24h: x.failures24h, incident: incidents[x.slug] }))}
        />
      )}
    </div>
  );
}
