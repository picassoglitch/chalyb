import { LandingNav } from './nav';
import { Hero } from './hero';
import { ProofBar } from './proof-bar';
import { Pillars } from './pillars';
import { HowItWorks } from './how-it-works';
import { Pricing } from './pricing';
import { FinalCta } from './final-cta';
import { LandingFooter } from './footer';

// Single-page conversion narrative, top to bottom:
// hero → proof strip → 3 value pillars → 3 steps → pricing → final CTA → footer.
// Fully server-rendered; the only interactivity is links into the auth flow.
export function LandingPage({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <div className="lp">
      <LandingNav isAuthenticated={isAuthenticated} />
      <main>
        <Hero />
        <ProofBar />
        <Pillars />
        <HowItWorks />
        <Pricing />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
