import { planPrice } from '@/config/pricing';
import { formatMXN } from '@/lib/billing/format';
import { toolList, type PublicTool } from '@/lib/tools/public-tools';

// The 8 FAQ entries (LANDING-SPEC §3.8), shared by the FAQPage JSON-LD so the
// structured data says exactly what the page says: Q1 only when the trial can
// be started (K-7), Q6 only when Señales is active. Amounts from config.
// Mirrors faq.tsx.

export interface FaqItem {
  id: number;
  q: string;
  a: string;
}

type Translate = (key: string, values?: Record<string, string>) => string;

export function faqItems(
  t: Translate,
  opts: { tools: PublicTool[]; locale: string; trialOffered: boolean; claimAll: boolean },
): FaqItem[] {
  const { tools, locale, trialOffered, claimAll } = opts;
  return [
    ...(trialOffered ? [{ id: 1, q: t('q1'), a: t('a1', { cero: formatMXN(0) }) }] : []),
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
}
