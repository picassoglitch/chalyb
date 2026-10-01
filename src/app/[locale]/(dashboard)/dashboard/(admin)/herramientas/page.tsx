import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireAdminPage } from '@/lib/admin/guard';
import { loadToolHealth } from '@/lib/admin/data';
import { ToolSwitches } from '@/components/dashboard/admin/tool-switches';

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
          tools={data.map((x) => ({ slug: x.slug, name: x.name, visible: x.status === 'active', health: x.health, failures24h: x.failures24h }))}
        />
      )}
    </div>
  );
}
