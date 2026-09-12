import { LandingNav } from './nav';
import { Hero } from './hero';
import { ProofBar } from './proof-bar';
import { Pillars } from './pillars';
import { HowItWorks } from './how-it-works';
import { Pricing } from './pricing';
import { FinalCta } from './final-cta';
import { LandingFooter } from './footer';

/**
 * Single-page conversion narrative. Every CTA on this page routes into the
 * auth flow (see ./links.ts); there are no section anchors in the header, no
 * inline forms, and no client-side state — the whole tree renders on the
 * server.
 *
 *   1. Hero            — outcome headline + primary CTA + product preview
 *   2. Proof bar       — metrics + stack
 *   3. Value pillars   — exactly three, alternating two-column
 *   4. How it works    — three steps
 *   5. Pricing         — three tiers, each CTA → /sign-in?mode=signup&plan=…
 *   6. Final CTA + footer
 */
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
