import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Inbox } from 'lucide-react';
import { getSessionUser } from '@/lib/auth/session';
import { getEntitlements } from '@/lib/billing/entitlement';
import { ENGINE_DISPLAY_NAMES } from '@/lib/engines/display-names';
import { collectResults } from '@/lib/results/collect';
import { toolHref } from '@/lib/tools/routes';
import { StateBlock } from '@/components/ui/primitives';
import { ResultsList } from '@/components/app/results-list';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('results');
  return { title: t('metaTitle') };
}

// Mis resultados (SCR-19, P3-13; alias /app/resultados). Real results only: clip
// jobs and property cards from the tools' adapters. No sample rows.

export default async function ResultadosPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('results');
  const session = await getSessionUser();
  if (!session) return null;
  const ent = await getEntitlements(session);
  const items = await collectResults(session.user.id, ent);
  const clipsIncluded = ent.tools.chalybclip?.state === 'included';

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <header>
        <h1 className="ch-h1">{t('title')}</h1>
        <p className="ch-sub">{t('sub')}</p>
      </header>
      {items.length === 0 ? (
        <StateBlock
          icon={<Inbox />}
          title={t('empty')}
          body={t('emptyBody')}
          action={clipsIncluded ? { href: toolHref('chalybclip'), label: t('emptyCta') } : undefined}
        />
      ) : (
        <ResultsList items={items} toolNames={ENGINE_DISPLAY_NAMES} />
      )}
    </div>
  );
}
