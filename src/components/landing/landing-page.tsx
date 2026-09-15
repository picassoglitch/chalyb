import type { PublicFleet } from '@/lib/data/public-engines';
import { LandingNav } from './nav';
import { Hero } from './hero';
import { ProofBar } from './proof-bar';
import { Pillars } from './pillars';
import { HowItWorks } from './how-it-works';
import { Pricing } from './pricing';
import { FinalCta } from './final-cta';
import { LandingFooter } from './footer';

/**
 * Single-page conversion narrative for the kit. Every CTA on this page routes
 * into the auth flow (see ./links.ts); the whole tree renders on the server.
 *
 *   1. Hero            — kit headline + primary CTA + the kit's REAL status
 *   2. Proof bar       — how the kit works, in numbers that are true
 *   3. Value pillars   — exactly three, alternating two-column
 *   4. How it works    — three steps
 *   5. Pricing         — Free sim / Pro one live / VIP whole kit
 *   6. Final CTA + footer (partner entry lives in the footer + a small note
 *      under pricing — never ahead of the subscribe story)
 *
 * `fleet` is the catalog's readiness (lib/data/public-engines). Nothing on
 * this page claims an engine is live unless that says so.
 */
export function LandingPage({
  isAuthenticated,
  fleet,
}: {
  isAuthenticated: boolean;
  fleet: PublicFleet;
}) {
  return (
    <div className="lp">
      <LandingNav isAuthenticated={isAuthenticated} />
      <main>
        <Hero fleet={fleet} />
        <ProofBar fleet={fleet} />
        <Pillars fleet={fleet} />
        <HowItWorks />
        <Pricing />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
