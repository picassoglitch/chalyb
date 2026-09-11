'use client';

import { useTranslations } from 'next-intl';

export function Marquee() {
  const t = useTranslations();
  const items = t.raw('marquee') as string[];
  return (
    <div className="marquee">
      <div className="marquee-track">
        <span>{items.join(' ')}</span>
        <span>{items.join(' ')}</span>
      </div>
    </div>
  );
}
