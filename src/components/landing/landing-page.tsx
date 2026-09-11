'use client';

import { Suspense, useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { PathProvider, usePath } from './use-path';
import { Cursor } from './cursor';
import { ProgressBar } from './progress-bar';
import { ModeBanner } from './mode-banner';
import { RevealObserver } from './reveal';
import { WebGLField } from './webgl-field';
import { MobileCinema } from './mobile-cinema';
import { LandingNav } from './nav';
import { Hero } from './hero';
import { Marquee } from './marquee';
import { ProofSection } from './proof-section';
import { ClientWorld } from './client-world';
import { PartnerWorld } from './partner-world';
import { EarnWorld } from './earn-world';
import { ContactSection } from './contact-section';
import { CtaSection } from './cta-section';
import { LandingFooter } from './footer';
import { OperatingSection } from './operating-section';
import { BuildingSection } from './building-section';
import { FounderSection } from './founder-section';

function PathOrderedSections() {
  const { sectionOrder } = usePath();
  const components: Record<string, React.ReactNode> = {
    proof: <ProofSection key="proof" />,
    'client-world': <ClientWorld key="client-world" />,
    'partner-world': <PartnerWorld key="partner-world" />,
    'earn-world': <EarnWorld key="earn-world" />,
  };
  return <>{sectionOrder.map((id) => components[id]).filter(Boolean)}</>;
}

function LandingInner({ isAuthenticated }: { isAuthenticated: boolean }) {
  const locale = useLocale();
  const { path } = usePath();
  // Mounted-flag guards the SSR vs client mismatch for window-dependent overlays.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <>
      {mounted && (
        <>
          <Cursor />
          <div className="grain" />
          <ProgressBar />
          <WebGLField />
        </>
      )}
      <LandingNav isAuthenticated={isAuthenticated} />
      <Hero />
      <ModeBanner />
      <Marquee />
      <PathOrderedSections />
      <OperatingSection />
      <BuildingSection />
      <FounderSection />
      <ContactSection />
      <CtaSection />
      <LandingFooter />
      <RevealObserver />
      <MobileCinema refreshKey={`${locale}:${path ?? 'neutral'}`} />
    </>
  );
}

export function LandingPage({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <Suspense fallback={null}>
      <PathProvider>
        <LandingInner isAuthenticated={isAuthenticated} />
      </PathProvider>
    </Suspense>
  );
}
