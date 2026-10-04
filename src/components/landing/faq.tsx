import { getTranslations } from 'next-intl/server';
import { ChevronDown } from 'lucide-react';
import type { PublicTool } from '@/lib/tools/public-tools';
import { faqItems } from './faq-items';
import { SectionHead } from './section-head';

// 7 · Preguntas frecuentes (#preguntas, LANDING-SPEC §3.8): 8 questions, two
// columns of 4 on desktop; the first (and on desktop the sixth) open. Amounts
// from config, the Pro list from the active tools. No invoice question until
// the owner confirms invoices (L2).

export async function Faq({
  tools,
  locale,
  trialOffered,
  claimAll,
}: {
  tools: PublicTool[];
  locale: string;
  /** The trial Q&A only when the trial can be started (K-7). */
  trialOffered: boolean;
  claimAll: boolean;
}) {
  const t = await getTranslations('landing.faq');
  // One source with the FAQPage JSON-LD (faq-items.ts).
  const items = faqItems((k, v) => t(k, v), { tools, locale, trialOffered, claimAll });

  return (
    <section id="preguntas" className="pub-band" aria-labelledby="faq-title">
      <div className="pub-wrap">
        <SectionHead id="faq-title" label={t('label')} title={t('title')} />
        <div className="pub-faq2">
          {items.map((item, i) => (
            <details
              key={item.id}
              className={`pub-fq${item.id === 6 ? ' pub-fq--desk-open' : ''}`}
              open={i === 0}
              data-faq={item.id}
            >
              <summary>
                {item.q}
                <span className="pub-fq__chev" aria-hidden="true">
                  <ChevronDown />
                </span>
              </summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
