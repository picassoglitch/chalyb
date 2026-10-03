// JSON-LD Organization + Offer for the landing (rebuild P4-8). Prices are the
// IVA-inclusive MXN totals from the pricing config. Pure.

import { planPrice, type PlanKey } from '@/config/pricing';
import { canonicalOrigin } from '@/lib/site';

/** `vipYear`: VIP anual is on sale (vipYearEnabled()). */
export function jsonLdData(origin = canonicalOrigin(), vipYear = false) {
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
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'Chalyb',
        url: `${origin}/`,
        logo: `${origin}/chalyb-mark.png`,
      },
      {
        '@type': 'Product',
        name: 'Chalyb Pro',
        brand: { '@type': 'Brand', name: 'Chalyb' },
        offers: [
          offer('pro_year', 'Chalyb Pro · Anual'),
          offer('pro_month', 'Chalyb Pro · Mensual'),
          offer('vip_month', 'Chalyb VIP'),
          ...(vipYear ? [offer('vip_year', 'Chalyb VIP · Anual')] : []),
        ],
      },
    ],
  };
}
