import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireAdminPage } from '@/lib/admin/guard';
import { loadPeople } from '@/lib/admin/data';
import { personActions } from '@/lib/admin/people';
import { PeopleTable, type PersonVM } from '@/components/dashboard/admin/people-table';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.people');
  return { title: t('metaTitle') };
}

// Personas (SCR-28, P5-2). Main's team tools (roles, credits, invites) stay
// at /dashboard/team under "Más".

export default async function PersonasPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminPage();
  const t = await getTranslations('admin');
  const { data, failed } = await loadPeople();
  const people: PersonVM[] = data.people.map((p) => {
    const charge = data.lastCharge.get(p.id) ?? null;
    return {
      id: p.id,
      name: p.name,
      email: p.email,
      plan: p.plan,
      status: p.status,
      since: p.since,
      actions: personActions(p, charge?.cents ?? null),
      refundCents: charge?.cents ?? null,
    };
  });
  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <header>
        <h1 className="ch-h1">{t('people.title')}</h1>
        <p className="ch-sub">{t('people.sub')}</p>
      </header>
      {failed ? <p role="alert" className="ch-card" style={{ padding: 16 }}>{t('home.loadFailed')}</p> : <PeopleTable people={people} />}
    </div>
  );
}
