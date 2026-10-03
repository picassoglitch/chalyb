// Emits the landing's JSON-LD only when paid checkout is live AND the legal
// texts are published (rebuild P4-8): before that there is no offer a search
// engine should advertise.

import { legalPublished, paidCheckoutEnabled, vipYearEnabled } from '@/lib/config/flags';
import { jsonLdData } from '@/lib/seo/json-ld';

export function JsonLd() {
  // Offers only when they can be bought, with the published terms.
  if (!(paidCheckoutEnabled() && legalPublished())) return null;
  return (
    <script
      type="application/ld+json"
      // Static data from config; no user input reaches it.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLdData(undefined, vipYearEnabled())).replace(/</g, '\\u003c'),
      }}
    />
  );
}
