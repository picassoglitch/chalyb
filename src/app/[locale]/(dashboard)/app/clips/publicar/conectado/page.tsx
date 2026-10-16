import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { loadPublishTool } from '@/lib/tools/adapters/clips/publish-page';
import { ToolErrorState } from '@/components/tools/tool-error-state';
import { ConnectedLanding } from '@/components/tools/clips/publish/connected-landing';
import '@/components/tools/clips/publish/publish.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clipsPublish.connected');
  // The vendor's redirect carries a one-time token in the query string:
  // never leak it as a Referer.
  return { title: t('metaTitle'), referrer: 'no-referrer', robots: { index: false } };
}

// Where a network's sign-in returns after connecting an account (the engine
// only accepts this hub page as the OAuth return). Back to the Publish
// Center; Facebook picks its Page here first.

export default async function ClipsPublishConnectedPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const q = await searchParams;
  const one = (k: string) => {
    const v = q[k];
    return (Array.isArray(v) ? v[0] : v) ?? '';
  };
  setRequestLocale(locale);
  const gate = await loadPublishTool(locale, '/app/clips/publicar/conectado');
  if (gate.kind === 'error') return <ToolErrorState slug="chalybclip" error={gate.error} />;
  return (
    <div className="ch-pub" style={{ maxWidth: 560, margin: '0 auto' }}>
      <ConnectedLanding
        params={{
          platform: one('platform') || one('connected'),
          tempToken: one('tempToken'),
          userProfile: one('userProfile'),
          accountId: one('accountId'),
          next: one('next') || null,
        }}
      />
    </div>
  );
}
