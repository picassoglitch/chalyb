// Hacer clips loading: the wizard bar and, with the engine, the source
// picker stay on screen (already showing the clicked source); the source's
// panel shimmers until the engine answers.

import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { getClipsEngineAdapter } from '@/lib/tools/adapters/clips';
import { CLIP_SOURCES, clipSourceHref } from '@/lib/tools/clips-sources';
import { WizardLoading } from '@/components/tools/tool-loading';
import { SourcePickerLive } from '@/components/tools/clips/engine/source-picker-live';
import '@/styles/tools-clips.css';
import '@/styles/tools-clips-engine.css';

const LABEL = { enlace: 'link', archivo: 'upload', transmision: 'live', canal: 'channel' } as const;

export default async function Loading() {
  const t = await getTranslations('clips');
  const tc = await getTranslations('clipsTool');
  const ts = await getTranslations('clipsEngine.newJob.sources');
  const items = CLIP_SOURCES.map((s) => ({ href: clipSourceHref(s), label: ts(LABEL[s]) }));
  return (
    <WizardLoading
      chrome={{
        slug: 'chalybclip',
        toolName: 'Clips',
        backHref: '/app/clips',
        backLabel: t('home'),
        closeLabel: tc('close'),
        closeHref: '/app/clips',
      }}
      top={
        getClipsEngineAdapter() ? (
          <Suspense fallback={null}>
            <SourcePickerLive label={ts('aria')} items={items} />
          </Suspense>
        ) : null
      }
    />
  );
}
