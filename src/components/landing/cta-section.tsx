'use client';

import { useTranslations } from 'next-intl';
import { usePath } from './use-path';

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

export function CtaSection() {
  const tCta = useTranslations('cta');
  const tNeutral = useTranslations('neutral');
  const tPath = useTranslations('path');
  const { path } = usePath();

  const sub = path ? tPath(`${path}.ctaSub`) : tNeutral('ctaSub');

  return (
    <section id="cta">
      <div className="reveal">
        <h2 className="cta-big" dangerouslySetInnerHTML={{ __html: tCta.raw('big') as string }} />
        <p className="cta-sub">{sub}</p>
        <button type="button" className="btn-primary" onClick={() => scrollToId('contact')}>
          <span>{tCta('btn')}</span>
          <span className="arrow">→</span>
        </button>
      </div>
    </section>
  );
}
