import { getTranslations } from 'next-intl/server';
import { ChevronDown } from 'lucide-react';
import { planPrice } from '@/config/pricing';
import { formatMXN } from '@/lib/billing/format';
import { toolList, type PublicTool } from '@/lib/tools/public-tools';
import { SectionHead } from './section-head';

// 7 · Preguntas frecuentes (#preguntas, LANDING-SPEC §3.8): 8 questions, two
// columns of 4 on desktop; the first (and on desktop the sixth) open. Amounts
// from config, the Pro list from the active tools. No CFDI question until
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
  const cero = formatMXN(0);
  const items = [
    ...(trialOffered ? [{ id: 1, q: t('q1'), a: t('a1', { cero }) }] : []),
    {
      id: 2,
      q: t('q2'),
      a: t('a2', {
        pro_mes: formatMXN(planPrice('pro_month').totalCents),
        pro_anual: formatMXN(planPrice('pro_year').totalCents),
      }),
    },
    { id: 3, q: t('q3'), a: t('a3') },
    { id: 4, q: t('q4'), a: t('a4') },
    {
      id: 5,
      q: t('q5'),
      a: claimAll ? t('a5', { lista: toolList(tools, locale) }) : t('a5NoClaim'),
    },
    ...(tools.some((x) => x.slug === 'chalybcrypto') ? [{ id: 6, q: t('q6'), a: t('a6') }] : []),
    { id: 7, q: t('q7'), a: t('a7') },
    { id: 8, q: t('q8'), a: t('a8') },
  ];

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
