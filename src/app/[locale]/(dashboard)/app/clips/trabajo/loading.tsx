// A clips job loading. With the engine (mode "a") the job is a video with
// the tool's tabs (the page sends it to /app/clips/videos/[id]); otherwise
// the focus-layout wizard.

import { getTranslations } from 'next-intl/server';
import { getClipsEngineAdapter } from '@/lib/tools/adapters/clips';
import { ToolLoading, WizardLoading } from '@/components/tools/tool-loading';

export default async function Loading() {
  if (getClipsEngineAdapter()) return <ToolLoading slug="chalybclip" tab="history" shape="panel" />;
  const t = await getTranslations('clips');
  const tc = await getTranslations('clipsTool');
  return (
    <WizardLoading
      chrome={{
        slug: 'chalybclip',
        toolName: 'Clips',
        backHref: '/app/clips',
        backLabel: t('back'),
        closeLabel: tc('close'),
        closeHref: '/app/clips',
      }}
    />
  );
}
