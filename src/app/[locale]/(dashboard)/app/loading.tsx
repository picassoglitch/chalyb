// Any app screen without its own loading state: the sidebar stays (it's
// the layout) and the page area shimmers on the click, instead of the old
// screen sitting frozen until the server answers.

import { getTranslations } from 'next-intl/server';
import { Skeleton } from '@/components/ui/primitives';

export default async function Loading() {
  const t = await getTranslations('toolShell');
  return (
    <div className="ch-loading" role="status" aria-live="polite" aria-busy="true">
      <span className="ch-sr">{t('loading')}</span>
      <Skeleton height={48} style={{ width: 'min(420px, 70%)' }} />
      <div className="ch-loading__grid ch-loading__grid--wide" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={180} />
        ))}
      </div>
      <Skeleton height={220} />
    </div>
  );
}
