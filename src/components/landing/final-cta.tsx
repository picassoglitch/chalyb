import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { toolList, type PublicTool } from '@/lib/tools/public-tools';

// 9 · Final CTA, with the active-tools list.

export async function FinalCta({
  tools,
  locale,
  trialHref,
}: {
  tools: PublicTool[];
  locale: string;
  trialHref: Route;
}) {
  const t = await getTranslations('landing');
  return (
    <section className="pub-band" aria-labelledby="final-title">
      <div className="pub-wrap">
        <div className="pub-final">
          <h2 id="final-title">{t('final.title')}</h2>
          <p>{t('final.sub', { lista: toolList(tools, locale) })}</p>
          <Link href={trialHref} className="ch-btn ch-btn--white ch-btn--xl" data-cta="trial-final">
            {t('cta')}
          </Link>
          <small>{t('ctaSub')}</small>
        </div>
      </div>
    </section>
  );
}
