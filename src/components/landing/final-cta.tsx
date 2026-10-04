import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { formatMXN } from '@/lib/billing/format';
import { toolList, type PublicTool } from '@/lib/tools/public-tools';

// 9 · CTA final (LANDING-SPEC §3.10), with the active tools.

export async function FinalCta({
  tools,
  locale,
  trialHref,
  ctaLabel,
  trialOffered,
}: {
  tools: PublicTool[];
  locale: string;
  trialHref: Route;
  ctaLabel: string;
  trialOffered: boolean;
}) {
  const t = await getTranslations('landing.final');
  return (
    <section className="pub-band pub-band--tight" aria-labelledby="final-title" id="final">
      <div className="pub-wrap">
        <div className="pub-final2">
          <h2 id="final-title">{t.rich('title', { em: (c) => <em>{c}</em> })}</h2>
          <p>
            <span className="pub-only-desk">{t('sub', { lista: toolList(tools, locale) })}</span>
            <span className="pub-only-mob">{t('subMobile')}</span>
          </p>
          <Link href={trialHref} className="ch-btn ch-btn--white pub-final2__cta" data-cta="final_trial">
            {ctaLabel}
          </Link>
          {trialOffered && <small>{t('note', { cero: formatMXN(0) })}</small>}
        </div>
      </div>
    </section>
  );
}
