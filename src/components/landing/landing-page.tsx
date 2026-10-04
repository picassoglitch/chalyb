// Landing `/` (LANDING-SPEC, mockups 40–44). Sections in the spec's order:
// nav · hero · herramientas · 3 pasos · galería · para quién · precios ·
// preguntas · socios · CTA final · footer. Everything that names, counts or
// illustrates a tool derives from the ACTIVE tools; every amount comes from
// config/pricing.ts; tool claims follow allToolsClaimAllowed() (C4/C15).

import { getLocale, getTranslations } from 'next-intl/server';
import { PublicNav } from '@/components/public/public-nav';
import { PublicFooter } from '@/components/public/public-footer';
import { allToolsClaimAllowed, trialFlowEnabled } from '@/lib/config/flags';
import { listActiveTools } from '@/lib/tools/public-tools-server';
import { loadPlansProps } from '@/lib/billing/plans-props';
import { formatMXN } from '@/lib/billing/format';
import { landingTrialHref } from './links';
import { Hero } from './hero';
import { ToolsSection } from './tools';
import { HowItWorks } from './how-it-works';
import { Gallery } from './gallery';
import { Audience } from './audience';
import { PlansSummary } from './plans-summary';
import { Partner } from './partner';
import { Faq } from './faq';
import { FinalCta } from './final-cta';
import { StickyCta } from './sticky-cta';
import { LandingClient } from './landing-client';
import { JsonLd } from './json-ld';
import '@/styles/chalyb-tokens.css';
import '@/styles/chalyb-public.css';
import '@/styles/chalyb-landing.css';

export async function LandingPage({ signedIn }: { signedIn: boolean }) {
  const [tools, locale, t] = await Promise.all([
    listActiveTools(),
    getLocale(),
    getTranslations('landing'),
  ]);
  const flow = trialFlowEnabled();
  const claimAll = allToolsClaimAllowed();
  const href = (from: Parameters<typeof landingTrialHref>[0]['from']) =>
    landingTrialHref({ from, trialFlowEnabled: flow, signedIn });
  const ctaLabel = flow ? t('cta') : t('ctaNoTrial');
  const plans = await loadPlansProps(locale);

  return (
    <div className="chalyb-app pub pub-landing">
      <a href="#main" className="ch-skip">
        {t('publicNav.skip')}
      </a>
      <PublicNav signedIn={signedIn} />
      <main id="main">
        <Hero trialHref={href('hero_trial')} ctaLabel={ctaLabel} />
        <ToolsSection
          tools={tools}
          claimAll={claimAll}
          trialHref={href('tools_trial')}
          ctaLabel={ctaLabel}
        />
        <HowItWorks />
        {tools.some((tool) => tool.slug === 'chalybclip') && <Gallery />}
        <Audience tools={tools} />
        <PlansSummary {...plans} />
        <Faq tools={tools} locale={locale} trialOffered={flow} claimAll={claimAll} />
        <Partner />
        <FinalCta
          tools={tools}
          locale={locale}
          trialHref={href('final_trial')}
          ctaLabel={ctaLabel}
          trialOffered={flow}
        />
      </main>
      <PublicFooter onLanding />
      <StickyCta
        href={href('sticky_trial')}
        label={ctaLabel}
        note={flow ? t('sticky.note', { cero: formatMXN(0) }) : null}
      />
      <LandingClient signedIn={signedIn} />
      <JsonLd />
    </div>
  );
}
