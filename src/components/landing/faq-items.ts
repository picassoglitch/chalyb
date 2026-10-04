import { planPrice } from '@/config/pricing';
import { formatMXN } from '@/lib/billing/format';
import { toolList, type PublicTool } from '@/lib/tools/public-tools';
import { claimKey } from './claims';

// The 8 FAQ entries (LANDING-SPEC §3.8), shared by the FAQPage JSON-LD so the
// structured data says exactly what the page says: Q1 only when the trial can
// be started (K-7), Q6 only when Señales is active. Q2, A2 and A8 name only
// the intervals on sale (offeredIntervals(), as the cards). Amounts from
// config.

export interface FaqItem {
  id: number;
  q: string;
  a: string;
}

type Translate = (key: string, values?: Record<string, string>) => string;

export function faqItems(
  t: Translate,
  opts: {
    tools: PublicTool[];
    locale: string;
    trialOffered: boolean;
    claimAll: boolean;
    intervals: readonly ('month' | 'year')[];
  },
): FaqItem[] {
  const { tools, locale, trialOffered, claimAll, intervals } = opts;
  const both = intervals.includes('month') && intervals.includes('year');
  const a2 = both ? 'a2' : intervals.includes('year') ? 'a2Year' : 'a2Month';
  return [
    ...(trialOffered ? [{ id: 1, q: t('q1'), a: t('a1', { cero: formatMXN(0) }) }] : []),
    {
      id: 2,
      // "después de los 7 días" only when the trial can be started.
      q: trialOffered ? t('q2') : t('q2NoTrial'),
      a: t(a2, {
        pro_mes: formatMXN(planPrice('pro_month').totalCents),
        pro_anual: formatMXN(planPrice('pro_year').totalCents),
      }),
    },
    { id: 3, q: t('q3'), a: t('a3') },
    { id: 4, q: t('q4'), a: t('a4') },
    {
      id: 5,
      q: t('q5'),
      a: t(claimKey('faqA5', claimAll), { lista: toolList(tools, locale) }),
    },
    ...(tools.some((x) => x.slug === 'chalybcrypto') ? [{ id: 6, q: t('q6'), a: t('a6') }] : []),
    { id: 7, q: t('q7'), a: t('a7') },
    // "pasar de mensual a anual" only when both are on sale.
    { id: 8, q: t('q8'), a: both ? t('a8') : t('a8OneInterval') },
  ];
}
