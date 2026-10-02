// SCR-10 / SCR-11 · Landing (BUILD-SPEC §8.1, rebuild P4-1). Sections in the
// spec's order. Everything that names, counts or illustrates a tool derives
// from the active tools (P4-4); every amount comes from the pricing config
// with "IVA incluido" in the same block; claims that depend on an owner
// decision sit behind their flag (P4-5).

import { getLocale, getTranslations } from 'next-intl/server';
import { PublicNav } from '@/components/public/public-nav';
import { PublicFooter } from '@/components/public/public-footer';
import { trialFlowEnabled } from '@/lib/config/flags';
import { listActiveTools } from '@/lib/tools/public-tools-server';
import { trialCtaHref } from './links';
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
import { JsonLd } from './json-ld';
import '@/styles/chalyb-tokens.css';
import '@/styles/chalyb-public.css';

export async function LandingPage({ signedIn }: { signedIn: boolean }) {
  const [tools, locale, t] = await Promise.all([
    listActiveTools(),
    getLocale(),
    getTranslations('landing'),
  ]);
  const trialHref = trialCtaHref({ trialFlowEnabled: trialFlowEnabled(), signedIn });

  return (
    <div className="chalyb-app pub">
      <a href="#main" className="ch-skip">
        {t('publicNav.skip')}
      </a>
      <PublicNav signedIn={signedIn} />
      <main id="main">
        <Hero tools={tools} trialHref={trialHref} />
        <ToolsSection tools={tools} />
        <HowItWorks />
        {tools.some((tool) => tool.slug === 'chalybclip') && <Gallery />}
        <Audience tools={tools} />
        <PlansSummary signedIn={signedIn} trialHref={trialHref} />
        <Partner />
        <Faq tools={tools} locale={locale} />
        <FinalCta tools={tools} locale={locale} trialHref={trialHref} />
      </main>
      <PublicFooter />
      <StickyCta href={trialHref} label={t('sticky')} />
      <JsonLd />
    </div>
  );
}
