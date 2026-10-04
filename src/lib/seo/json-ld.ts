// JSON-LD for the landing (LANDING-SPEC §6, rebuild P4-8): Organization,
// SoftwareApplication with its offers, WebSite, and the FAQPage. Prices are
// the IVA-inclusive MXN totals from the pricing config, never typed. Pure.

import { planPrice, type PlanKey } from '@/config/pricing';
import { canonicalOrigin } from '@/lib/site';

/** `vipYear`: VIP anual is on sale (vipYearEnabled()). `withOffers`: paid
 *  checkout is live with the published terms; without it the app is
 *  described with no offer a search engine could advertise. */
export function jsonLdData(origin = canonicalOrigin(), vipYear = false, withOffers = true) {
  const offer = (key: PlanKey, name: string) => ({
    '@type': 'Offer',
    name,
    price: (planPrice(key).totalCents / 100).toFixed(2),
    priceCurrency: 'MXN',
    // valueAddedTaxIncluded: totals always include IVA (Hard rule 7).
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: (planPrice(key).totalCents / 100).toFixed(2),
      priceCurrency: 'MXN',
      valueAddedTaxIncluded: true,
      unitCode: planPrice(key).interval === 'year' ? 'ANN' : 'MON',
    },
    url: `${origin}/planes`,
  });
  const organization = { '@id': `${origin}/#organization` };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        ...organization,
        name: 'Chalyb',
        url: `${origin}/`,
        logo: `${origin}/chalyb-mark.png`,
      },
      {
        '@type': 'SoftwareApplication',
        name: 'Chalyb',
        url: `${origin}/`,
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Web',
        publisher: organization,
        ...(withOffers
          ? {
              offers: [
                offer('pro_year', 'Chalyb Pro · Anual'),
                offer('pro_month', 'Chalyb Pro · Mensual'),
                offer('vip_month', 'Chalyb VIP'),
                ...(vipYear ? [offer('vip_year', 'Chalyb VIP · Anual')] : []),
              ],
            }
          : {}),
      },
      {
        '@type': 'WebSite',
        name: 'Chalyb',
        url: `${origin}/`,
        inLanguage: ['es-MX', 'en'],
        publisher: organization,
      },
    ],
  };
}

/** FAQPage from the questions the page shows (faq-items.ts). */
export function faqPageData(items: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}
