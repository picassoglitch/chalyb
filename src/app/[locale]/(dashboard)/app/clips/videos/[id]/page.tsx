import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { engineRead, loadClipsEngine } from '@/lib/tools/clips-engine';
import { loadClipJob } from '@/lib/tools/clips-jobs';
import { getStream } from '@/lib/tools/adapters/clips/engine-api';
import { ClipsEngineError } from '@/lib/tools/adapters/clips/errors';
import { ClipsGateView, ClipsReadError } from '@/components/tools/clips/engine/gate';
import { EngineVideoPage } from '@/components/tools/clips/engine/video-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clipsEngine.videos');
  return { title: t('metaTitle') };
}

// One video (mode "a"): the whole run — steps, clips, cost, actions. The job
// policy runs first, so the "clips ready" notice goes out exactly once.

export default async function ClipsVideoPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) notFound();
  const g = await loadClipsEngine(locale, `/app/clips/videos/${id}`);
  if (g.kind !== 'ready') return <ClipsGateView gate={g} tab="history" />;
  const job = await loadClipJob(g.session.user.id, id).catch((err: unknown) => {
    if (err instanceof ClipsEngineError && err.engineCode === 'not_found') return null;
    return undefined; // engine trouble: the read below reports it
  });
  if (job === null) notFound();
  const res = await engineRead(g, (e, signal) => getStream(e, id, signal));
  if (!res.ok) {
    if (res.error.reason === 'not_found') notFound();
    return <ClipsReadError error={res.error} tab="history" />;
  }
  return <EngineVideoPage d={res.data} editorReady={g.engineAdapter.capabilities().editClips} />;
}
