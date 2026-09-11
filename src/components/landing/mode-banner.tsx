'use client';

import { useTranslations } from 'next-intl';
import { usePath } from './use-path';

export function ModeBanner() {
  const { path, setPath } = usePath();
  const tBanner = useTranslations('banner');
  const tPath = useTranslations('path');

  const name = path ? tPath(`${path}.name`) : '';

  return (
    <div className={`mode-banner${path ? ' show' : ''}`}>
      <div className="mb-dot" />
      <div className="mb-label">
        {tBanner('viewing')} <b>{name}</b>
      </div>
      <button type="button" className="mb-switch" onClick={() => setPath(null)}>
        {tBanner('switch')}
      </button>
    </div>
  );
}
