import type { Route } from 'next';
import { Link } from '@/i18n/routing';

/**
 * English terms of service. Faithful translation of terms.es.tsx — same
 * sections, same numbering, same anchors. Governing law stays Mexican (see
 * section 15); the English version describes the same agreement, it is not a
 * separate contract.
 */
export function TermsDocumentEn() {
  return (
    <>
      <div className="legal-toc">
        <strong style={{ color: 'var(--ink)', display: 'block', marginBottom: 8 }}>Contents</strong>
        <ol>
          <li>
            <a href="#aceptacion">Acceptance of the terms</a>
          </li>
          <li>
            <a href="#definiciones">Definitions</a>
          </li>
          <li>
            <a href="#cuenta">Your account</a>
          </li>
          <li>
            <a href="#planes">Plans and subscriptions</a>
          </li>
          <li>
            <a href="#pagos">Payments, renewal and cancellation</a>
          </li>
          <li>
            <a href="#reembolsos">Refund policy</a>
          </li>
          <li>
            <a href="#engines">Engines and integrated products</a>
          </li>
          <li>
            <a href="#uso">Acceptable use</a>
          </li>
          <li>
            <a href="#contenido">Your content and licences</a>
          </li>
          <li>
            <a href="#propiedad">Chalyb intellectual property</a>
          </li>
          <li>
            <a href="#disponibilidad">Service availability</a>
          </li>
          <li>
            <a href="#responsabilidad">Limitation of liability</a>
          </li>
          <li>
            <a href="#terminacion">Suspension and termination</a>
          </li>
          <li>
            <a href="#cambios">Changes to these terms</a>
          </li>
          <li>
            <a href="#ley">Governing law and jurisdiction</a>
          </li>
          <li>
            <a href="#contacto">Contact</a>
          </li>
        </ol>
      </div>

      <p>
        Welcome to Chalyb. These terms of service (the «Terms») are an agreement between you (the
        «User») and <strong>Chalyb</strong>, operated from Mexico. By creating an account, buying a
        subscription or using any of our products, you accept these Terms in full. If you do not
        agree, do not use the service.
      </p>

      <h2 id="aceptacion">1. Acceptance of the terms</h2>
      <p>
        Access to Chalyb and to the Engines is conditional on your acceptance of these Terms.
        Whenever we make a substantial change, we notify you by email and publish the updated
        version on this page at least <strong>14 calendar days</strong> before it takes effect. If
        you keep using the service after that date, you accept the changes.
      </p>

      <h2 id="definiciones">2. Definitions</h2>
      <ul>
        <li>
          <strong>Platform</strong>: the <code>chalyb.com</code> website, including the operator
          panel (<code>/app</code>), the administrative dashboard (<code>/dashboard</code>), the
          public APIs, and the marketing pages.
        </li>
        <li>
          <strong>Engine</strong>: each independent product integrated into the Platform. As of this
          version: <strong>ChalybClip</strong> (clip generator from streams/VODs) and{' '}
          <strong>ChalybStreamManager</strong>
          (central control for live broadcasts). Each Engine runs on its own infrastructure under
          its own licence and usage policy.
        </li>
        <li>
          <strong>Subscription</strong>: recurring monthly access to the Platform and to one or more
          Engines, according to the plan you bought.
        </li>
        <li>
          <strong>Tier</strong>: access level. Current tiers:
          <code>FREE</code>, <code>PRO</code>, <code>VIP</code>. What each one includes is published
          at <Link href={'/app/subscription' as Route}>/app/subscription</Link>.
        </li>
        <li>
          <strong>Content</strong>: any data you upload, generate through an Engine, or enter into
          the Platform (VODs, prompts, configurations, third-party OAuth credentials, etc.).
        </li>
      </ul>

      <h2 id="cuenta">3. Your account</h2>
      <p>You need an account to use the Engines. When you sign up:</p>
      <ul>
        <li>You must be 18 or older, or have authorisation from the legal account holder.</li>
        <li>You agree to give accurate information and keep it up to date.</li>
        <li>
          You are responsible for your account’s security — password, active sessions and, if you
          enabled it, the second factor (2FA).
        </li>
        <li>
          An account is individual. Do not share it. For team access use the{' '}
          <Link href={'/dashboard/team' as Route}>/dashboard/team</Link> panel with the configured
          roles.
        </li>
      </ul>
      <p>
        We reserve the right to suspend accounts created with false information, accounts abusing
        the Free tier (multiple accounts for the same person), or accounts breaking the
        acceptable-use rules.
      </p>

      <h2 id="planes">4. Plans and subscriptions</h2>
      <p>We currently offer three tiers:</p>
      <ul>
        <li>
          <strong>Free</strong>: $0 MXN. Access to every Engine in simulation mode. No live
          execution. Reduced quotas.
        </li>
        <li>
          <strong>Pro</strong>: $749 MXN / month. Live execution of ONE Engine of your choice,
          extended quotas, email support.
        </li>
        <li>
          <strong>VIP</strong>: $2,499 MXN / month. Live execution of every active Engine, maximum
          quotas, priority support.
        </li>
      </ul>
      <p>
        Prices may change — we notify you by email at least 30 calendar days before applying the new
        price to your active subscription. If you do not agree, you can cancel before the change
        date at no extra cost.
      </p>

      <h2 id="pagos">5. Payments, renewal and cancellation</h2>
      <p>
        Payments are processed through <strong>Mercado Pago</strong>. By activating a paid
        subscription you authorise the recurring monthly charge to the payment method you
        registered. Renewal is automatic until you cancel.
      </p>
      <p>
        <strong>Cancelling</strong>: from{' '}
        <Link href={'/app/subscription' as Route}>/app/subscription</Link> → «Cancel plan».
        Cancellation is <strong>immediate</strong> as far as non-renewal goes, but{' '}
        <strong>
          you keep access to the current plan until the end of the period you already paid for
        </strong>
        . After that you drop to Free automatically.
      </p>
      <p>
        If the recurring charge fails (expired card, insufficient funds, bank rejection), we notify
        you by email and retry three times over the following 7 days. If all three attempts fail, we
        temporarily suspend live execution until you resolve the payment. Your data is not deleted
        during this period.
      </p>

      <h2 id="reembolsos">6. Refund policy</h2>
      <p>
        We refund <strong>100% of the first charge</strong> if you ask within{' '}
        <strong>7 calendar days</strong> of it. After that, charges are non-refundable, but you can
        cancel renewal at any time.
      </p>
      <p>
        To request a refund, write to us through <Link href={'/contacto' as Route}>/contacto</Link>{' '}
        with the subject «Refund» and include the payment ID. We process eligible refunds within 5
        to 10 business days, subject to Mercado Pago’s own timings.
      </p>

      <h2 id="engines">7. Engines and integrated products</h2>
      <p>
        Each Engine is an independent product operating under its own licence and technical rules.
        When you activate an Engine from Chalyb:
      </p>
      <ul>
        <li>
          You also accept that Engine’s specific terms, if it publishes any. We show them to you at
          first activation.
        </li>
        <li>
          Chalyb provisions an account for you on the Engine and keeps your tier (Free / Pro / VIP)
          in sync.
        </li>
        <li>
          Job execution (clips, broadcasts, AI calls) runs on the Engine’s infrastructure. Logs,
          failures or technical disputes related to that execution are handled through Chalyb, which
          coordinates with the Engine’s operator.
        </li>
      </ul>
      <p>
        <strong>ChalybClip</strong> in particular processes video content that you upload or
        download from external sources. You are responsible for holding the rights to that content
        (see Section 9).
      </p>

      <h2 id="uso">8. Acceptable use</h2>
      <p>You may NOT use Chalyb or the Engines to:</p>
      <ul>
        <li>
          Carry out activities that are illegal under Mexican law or the law of your jurisdiction.
        </li>
        <li>
          Process content that infringes third-party copyright, trademarks or image rights without
          authorisation.
        </li>
        <li>
          Generate or distribute content promoting hate, violence, abuse or deliberate
          disinformation.
        </li>
        <li>
          Run mass scraping, brute-force attacks, or attempt to evade quotas and technical limits.
        </li>
        <li>Resell access to Chalyb or to an Engine without prior written authorisation.</li>
        <li>Use the Platform to train competing AI models without a written agreement.</li>
      </ul>
      <p>
        Detected violations may result in temporary suspension, account termination without refund,
        and/or a report to the relevant authorities.
      </p>

      <h2 id="contenido">9. Your content and licences</h2>
      <p>
        <strong>You own your content.</strong> We claim no ownership over the VODs you upload, the
        clips ChalybClip generates for you, the prompts you write, or the streams you route via
        ChalybStreamManager.
      </p>
      <p>
        To operate the service, however, you grant us a{' '}
        <strong>limited, non-exclusive, royalty-free licence</strong> to:
      </p>
      <ul>
        <li>
          Store, process and transmit your content on the infrastructure needed to run the Engines
          (our own servers, Supabase, GPU compute providers).
        </li>
        <li>
          Generate technical derivatives (clips, transcripts, thumbnails, caption variants, vector
          embeddings) when you request them through an Engine.
        </li>
        <li>
          Use aggregated and anonymised metadata (not your content itself) to improve our products.
        </li>
      </ul>
      <p>
        This licence ends when you delete the content or close your account, with a reasonable
        margin to purge technical copies from backups (up to 90 days).
      </p>

      <h2 id="propiedad">10. Chalyb intellectual property</h2>
      <p>
        The name, logo, source code, design and logic of Chalyb and of the Engines belong to their
        respective owners. Your subscription gives you the right to <strong>use</strong> the
        service, not to copy it, redistribute it, decompile it, or create derivative works from it.
      </p>

      <h2 id="disponibilidad">11. Service availability</h2>
      <p>
        We do our best to keep Chalyb and the Engines available 24/7, but{' '}
        <strong>we do not guarantee contractual uptime</strong>. There may be:
      </p>
      <ul>
        <li>Scheduled maintenance (we notify you by email at least 24 hours in advance).</li>
        <li>
          Outages from causes outside our control (cloud provider failures, DDoS attacks, network
          faults).
        </li>
        <li>
          Changes to features, APIs or engines as the platform evolves. We keep reasonable backward
          compatibility and give at least 60 days’ notice of changes that break existing
          integrations.
        </li>
      </ul>

      <h2 id="responsabilidad">12. Limitation of liability</h2>
      <div className="legal-callout">
        <strong>This section limits what you can claim from us legally.</strong> Read it carefully.
      </div>
      <p>To the maximum extent permitted by applicable law:</p>
      <ul>
        <li>
          Chalyb provides the service «as is» (<em>as-is</em>), without express or implied
          warranties beyond those the law requires.
        </li>
        <li>
          We are not liable for indirect, incidental or consequential damages (lost profits, data
          loss, reputational harm, etc.) arising from the use of or inability to use the service.
        </li>
        <li>
          Our total cumulative liability for any claim is limited to the amount you paid Chalyb
          during the <strong>12 months immediately preceding</strong> the event giving rise to the
          claim.
        </li>
        <li>
          Nothing in these Terms limits liabilities that Mexican law declares non-waivable (for
          example, consumer rights under the LFPC).
        </li>
      </ul>

      <h2 id="terminacion">13. Suspension and termination</h2>
      <p>
        <strong>You can terminate</strong> your account at any time. Cancel the subscription from{' '}
        <Link href={'/app/subscription' as Route}>/app/subscription</Link>, then request account
        deletion through <Link href={'/contacto' as Route}>/contacto</Link>. We delete your personal
        data within a maximum of 30 calendar days, keeping only what the law requires (tax invoices,
        anti-fraud logs).
      </p>
      <p>
        <strong>We may terminate</strong> your account immediately, without refund, if:
      </p>
      <ul>
        <li>You break the acceptable-use rules (Section 8).</li>
        <li>You miss two consecutive payment cycles after the notices.</li>
        <li>We detect fraudulent or malicious use of the service.</li>
      </ul>

      <h2 id="cambios">14. Changes to these terms</h2>
      <p>
        We may modify these Terms to reflect legal changes, new products, price adjustments or
        operational clarifications. For substantial changes:
      </p>
      <ul>
        <li>We publish the new version on this page with the «Last updated» date.</li>
        <li>We email you at least 14 calendar days before it takes effect.</li>
        <li>If you keep using the service after that date, you accept the new version.</li>
        <li>If you do not agree, you can cancel before that date with no penalty.</li>
      </ul>

      <h2 id="ley">15. Governing law and jurisdiction</h2>
      <p>
        These Terms are governed by the laws of the <strong>United Mexican States</strong>, without
        regard to conflict of laws. For any dispute that cannot be resolved amicably, the parties
        submit to the jurisdiction of the competent courts of <strong>Mexico City</strong>,
        expressly waiving any other venue that might apply to them.
      </p>
      <p>
        If you are a consumer under Mexico’s Federal Consumer Protection Law (LFPC), you keep every
        right that law grants you, including the right to file complaints with PROFECO.
      </p>

      <h2 id="contacto">16. Contact</h2>
      <p>
        For any question about these Terms, write to us through{' '}
        <Link href={'/contacto' as Route}>/contacto</Link>. We respond in under 24 business hours.
      </p>

      <div className="legal-callout" style={{ marginTop: 40 }}>
        <strong>About this document:</strong> this version is a reasonable operating baseline for a
        multi-engine SaaS in Mexico. For use in real disputes, enterprise contracts, or expansion to
        other jurisdictions, have a specialist lawyer review it and adapt it to your specific
        situation.
      </div>
    </>
  );
}
