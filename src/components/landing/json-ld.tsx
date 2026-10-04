// The landing's JSON-LD (LANDING-SPEC §6): Organization, SoftwareApplication
// and WebSite always; the offers only when paid checkout is live AND the
// legal texts are published (rebuild P4-8), since before that there is no
// offer a search engine should advertise. FAQPage carries the same questions
// the page shows (faq-items.ts).

import { getLocale, getTranslations } from 'next-intl/server';
import {
  allToolsClaimAllowed,
  legalPublished,
  paidCheckoutEnabled,
  trialFlowEnabled,
  vipYearEnabled,
} from '@/lib/config/flags';
import { offeredIntervals } from '@/lib/billing/plans-props';
import { faqPageData, jsonLdData } from '@/lib/seo/json-ld';
import { listActiveTools } from '@/lib/tools/public-tools-server';
import { faqItems } from './faq-items';

function LdScript({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // Static data from config and messages; no user input reaches it.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

export async function JsonLd() {
  const [tools, locale, t, intervals] = await Promise.all([
    listActiveTools(),
    getLocale(),
    getTranslations('landing.faq'),
    offeredIntervals(),
  ]);
  const offers = paidCheckoutEnabled() && legalPublished();
  const faq = faqItems(t, {
    tools,
    locale,
    trialOffered: trialFlowEnabled(),
    claimAll: allToolsClaimAllowed(),
    intervals,
  });
  return (
    <>
      <LdScript data={jsonLdData(undefined, vipYearEnabled(), offers)} />
      <LdScript data={faqPageData(faq)} />
    </>
  );
}
