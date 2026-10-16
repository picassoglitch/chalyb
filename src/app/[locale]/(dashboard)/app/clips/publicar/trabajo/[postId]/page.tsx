import type { Metadata, Route } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ChevronLeft } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { loadPublishTool } from '@/lib/tools/adapters/clips/publish-page';
import { ToolShell } from '@/components/tools/tool-shell';
import { ToolErrorState } from '@/components/tools/tool-error-state';
import { ToolLockedState, lockedOffer } from '@/components/tools/tool-locked-state';
import { SetupState } from '@/components/ui/setup-state';
import { JobStatus } from '@/components/tools/clips/publish/job-status';
import '@/styles/tools-clips.css';
import '@/components/tools/clips/publish/publish.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clipsPublish.job');
  return { title: t('metaTitle') };
}

// "Tu publicación": one post's result on each network (the Clips app's
// /dashboard/publish/zernio/job/{id}). Polls until it settles.

export default async function ClipsPublishJobPage({
  params,
}: {
  params: Promise<{ locale: string; postId: string }>;
}) {
  const { locale, postId } = await params;
  setRequestLocale(locale);
  const gate = await loadPublishTool(locale, `/app/clips/publicar/trabajo/${postId}`);
  if (gate.kind === 'locked')
    return (
      <ToolShell
        slug="chalybclip"
        tab={null}
        plan={lockedOffer(gate.entitlements).trial ? 'offer' : 'pro'}
      >
        <ToolLockedState slug="chalybclip" entitlements={gate.entitlements} />
      </ToolShell>
    );
  if (gate.kind !== 'ready')
    return (
      <ToolShell slug="chalybclip" tab="publish">
        {gate.kind === 'error' && <ToolErrorState slug="chalybclip" error={gate.error} />}
        {gate.kind === 'setup' && (
          <SetupState step={gate.step} alternativeHref="/app/clips/nuevo" />
        )}
      </ToolShell>
    );
  const t = await getTranslations('clipsPublish.job');
  return (
    <ToolShell slug="chalybclip" tab="publish">
      <Link className="ch-back" href={'/app/clips/publicar?tab=publicados' as Route}>
        <ChevronLeft aria-hidden="true" />
        {t('back')}
      </Link>
      <JobStatus postId={postId} />
    </ToolShell>
  );
}
