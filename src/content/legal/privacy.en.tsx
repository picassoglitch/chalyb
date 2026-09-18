import type { Route } from 'next';
import { Link } from '@/i18n/routing';

/**
 * English privacy notice. Faithful translation of privacy.es.tsx — same
 * sections, same numbering, same anchors — so /en/legal/privacy#derechos and
 * /legal/privacy#derechos are the same section of the same document.
 *
 * The obligations described are Mexican (LFPDPPP/INAI): Chalyb operates from
 * Mexico, so the English text describes the same legal regime rather than
 * substituting a local equivalent.
 */
export function PrivacyDocumentEn() {
  return (
    <>
      <div className="legal-toc">
        <strong style={{ color: 'var(--ink)', display: 'block', marginBottom: 8 }}>Contents</strong>
        <ol>
          <li>
            <a href="#responsable">Data controller</a>
          </li>
          <li>
            <a href="#datos">Data we collect</a>
          </li>
          <li>
            <a href="#finalidades">Purposes of processing</a>
          </li>
          <li>
            <a href="#terceros">Third parties we share data with</a>
          </li>
          <li>
            <a href="#engines">Data sent to the Engines</a>
          </li>
          <li>
            <a href="#cookies">Cookies and similar technologies</a>
          </li>
          <li>
            <a href="#retencion">Data retention</a>
          </li>
          <li>
            <a href="#derechos">Your ARCO rights</a>
          </li>
          <li>
            <a href="#transferencias">International transfers</a>
          </li>
          <li>
            <a href="#seguridad">Security measures</a>
          </li>
          <li>
            <a href="#menores">Minors</a>
          </li>
          <li>
            <a href="#cambios">Changes to this notice</a>
          </li>
          <li>
            <a href="#contacto">Contact</a>
          </li>
        </ol>
      </div>

      <p>
        This privacy notice describes how <strong>Chalyb</strong> collects, uses, stores and
        protects your personal data, in compliance with Mexico’s{' '}
        <strong>
          Federal Law on the Protection of Personal Data Held by Private Parties (LFPDPPP)
        </strong>
        , its Regulations, and the INAI guidelines.
      </p>

      <h2 id="responsable">1. Data controller</h2>
      <p>
        <strong>Chalyb</strong>, operating from Mexico, is the controller of your personal data. To
        exercise any right or ask questions about this notice, write to us through{' '}
        <Link href={'/contacto' as Route}>/contacto</Link>.
      </p>

      <h2 id="datos">2. Data we collect</h2>
      <p>We collect strictly what the service needs to operate:</p>

      <h3>2.1. Account data</h3>
      <ul>
        <li>Full name</li>
        <li>Email address</li>
        <li>Profile photo (if you sign up with Google)</li>
        <li>Password hashed with bcrypt — we never store the plaintext</li>
      </ul>

      <h3>2.2. Payment data</h3>
      <ul>
        <li>
          Transaction ID and amounts processed by <strong>Mercado Pago</strong>. We do NOT store
          your card details — Mercado Pago handles those directly under its own privacy notice.
        </li>
        <li>Tier history (Free / Pro / VIP) and the date of every change.</li>
      </ul>

      <h3>2.3. Usage data</h3>
      <ul>
        <li>
          AI token consumption events per engine — when, how many, and which engine used them.
        </li>
        <li>Sign-in records (date and time, IP, browser) — kept for 90 days to detect fraud.</li>
        <li>Active engine selection, bot configuration, execution preferences.</li>
      </ul>

      <h3>2.4. Content you generate in the Engines</h3>
      <ul>
        <li>VODs you upload to ChalyClip, generated clips, transcripts, caption variants.</li>
        <li>
          Streams routed via ChalyStreamManager, saved layouts, OAuth connections to destination
          platforms (TikTok, YouTube, Twitch, Kick).
        </li>
        <li>Prompts, AI persona configurations, saved contexts.</li>
      </ul>
      <p>
        We store your content encrypted and only process it when you ask us to. We do not use it to
        train public models and we do not share it with third parties without your permission.
      </p>

      <h2 id="finalidades">3. Purposes of processing</h2>
      <p>We process your data to:</p>
      <ul>
        <li>
          <strong>Operate the service</strong> you signed up for (subscription, engine execution,
          payments).
        </li>
        <li>
          <strong>Transactional communication</strong>: payment confirmations, quota alerts,
          security notifications.
        </li>
        <li>
          <strong>Technical support</strong>: answering the requests you send through /contacto.
        </li>
        <li>
          <strong>Tax invoicing</strong>: issuing a CFDI when you request one with your RFC.
        </li>
        <li>
          <strong>Legal compliance</strong>: responding to legally valid requests from authorities.
        </li>
        <li>
          <strong>Fraud detection</strong>: analysing payment and usage patterns to prevent abuse.
        </li>
        <li>
          <strong>Product improvement</strong>: aggregate, anonymous statistics — never with data
          that identifies you.
        </li>
      </ul>
      <p>
        <strong>We do NOT use your data for:</strong> third-party advertising, selling databases,
        training public AI models, or building profiles for purposes unrelated to the service.
      </p>

      <h2 id="terceros">4. Third parties we share data with</h2>
      <p>
        We share strictly what is necessary with the providers that help us run the service. All of
        them are bound by contractual obligations of confidentiality and limited processing:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> (USA) — database, authentication, storage. Hosts your account
          and content. SOC2 Type II compliant.
        </li>
        <li>
          <strong>Mercado Pago</strong> (Argentina/Mexico) — payment processing. Receives your email
          and the amount in order to take the payment.
        </li>
        <li>
          <strong>Vercel</strong> (USA) — hosting for the web platform. Receives anonymised access
          logs.
        </li>
        <li>
          <strong>Resend</strong> (USA) — transactional email delivery. Receives your email address
          and name.
        </li>
        <li>
          <strong>Anthropic</strong> (USA) — provider of the Claude model. Receives the prompts you
          send through the engines, with no account metadata attached. Anthropic does not train on
          this data.
        </li>
        <li>
          <strong>Integrated Engines</strong> (ChalyClip, ChalyStreamManager): see section 5.
        </li>
      </ul>

      <h2 id="engines">5. Data sent to the Engines</h2>
      <p>When you activate an Engine, Chalyb creates an account for you on it. We send it:</p>
      <ul>
        <li>Your Chalyb user_id (an opaque identifier).</li>
        <li>Your email address.</li>
        <li>Your display name.</li>
        <li>
          Your current tier (free / pro / vip) — so the engine knows which features to enable for
          you.
        </li>
      </ul>
      <p>
        That information lets the Engine create your workspace and validate your access. Any
        additional content you generate <strong>inside</strong> the Engine (VODs, clips,
        configurations) is governed by that particular Engine’s privacy notice, which you accept
        when you first activate it.
      </p>

      <h2 id="cookies">6. Cookies and similar technologies</h2>
      <p>We use cookies to:</p>
      <ul>
        <li>
          <strong>Session</strong>: keep you signed in (HTTP-only, secure, SameSite=Lax cookie).
          Essential to use the platform.
        </li>
        <li>
          <strong>Preferences</strong>: remember your language (es/en) and the tier selected in the
          picker. Expires after 12 months.
        </li>
        <li>
          <strong>Anonymous analytics</strong> (Vercel Analytics): pageview counts without
          identifying you personally. No third-party cookies, no cross-site tracking.
        </li>
      </ul>
      <p>We do not use advertising cookies, cross-site tracking, or browser fingerprinting.</p>

      <h2 id="retencion">7. Data retention</h2>
      <ul>
        <li>
          <strong>Active account</strong>: your data is kept for as long as your account is open.
        </li>
        <li>
          <strong>After closing your account</strong>: we delete your identifiable personal data
          within a maximum of 30 calendar days.
        </li>
        <li>
          <strong>Legal exceptions</strong>: tax invoices (5 years, required by the SAT),
          fraud/security logs (90 days after closure), technical backups (up to 90 days after the
          primary deletion).
        </li>
        <li>
          <strong>Aggregated/anonymised data</strong>: may be kept indefinitely for statistics and
          service improvement. This data cannot be used to re-identify you.
        </li>
      </ul>

      <h2 id="derechos">8. Your ARCO rights</h2>
      <p>Under the LFPDPPP, you have the right to:</p>
      <ul>
        <li>
          <strong>Access</strong>: request a copy of the data we hold about you.
        </li>
        <li>
          <strong>Rectification</strong>: correct inaccurate or incomplete data.
        </li>
        <li>
          <strong>Cancellation</strong>: request deletion of your data (subject to the legal
          exceptions above).
        </li>
        <li>
          <strong>Opposition</strong>: object to a specific use of your data.
        </li>
      </ul>
      <p>In addition, you can:</p>
      <ul>
        <li>
          <strong>Withdraw your consent</strong> at any time, which ends your use of the service.
        </li>
        <li>
          <strong>Limit use</strong> to the purposes strictly necessary for the service you signed
          up for.
        </li>
        <li>
          <strong>Port your data</strong>: export it in structured JSON format to take it to another
          provider.
        </li>
      </ul>
      <p>
        To exercise any of these rights, write to us through{' '}
        <Link href={'/contacto' as Route}>/contacto</Link> with the subject «ARCO rights». We
        respond within <strong>20 business days</strong>, the deadline set by the LFPDPPP. If you
        are not satisfied with our response, you may file a complaint with <strong>INAI</strong>{' '}
        (Mexico’s National Institute for Transparency, Access to Information and Personal Data
        Protection).
      </p>

      <h2 id="transferencias">9. International transfers</h2>
      <p>
        Some of our providers (Supabase, Vercel, Resend, Anthropic) operate from the United States.
        By using Chalyb you <strong>authorise the international transfers necessary</strong> for the
        service to work.
      </p>
      <p>
        These providers meet standards equivalent to or higher than those the LFPDPPP requires. We
        maintain contractual clauses obliging them to protect your data to international standards
        (SOC2, ISO 27001, GDPR where applicable).
      </p>

      <h2 id="seguridad">10. Security measures</h2>
      <p>We apply reasonable technical and administrative measures to protect your data:</p>
      <ul>
        <li>Encryption in transit (HTTPS/TLS 1.3) for all communication.</li>
        <li>Encryption at rest for sensitive data in the database.</li>
        <li>Irreversible hashing for passwords (bcrypt).</li>
        <li>Optional two-factor authentication (2FA) for accounts.</li>
        <li>Row-Level Security in Supabase to isolate data between users.</li>
        <li>Service-role keys never exposed to the client.</li>
        <li>
          Audit logs for administrative actions (tier and role changes, access to other users’
          data).
        </li>
        <li>Automatic daily backups with 7-day retention.</li>
        <li>Production access restricted to authorised staff with MFA.</li>
      </ul>
      <p>
        No security measure is perfect. If a breach puts your personal data at risk, we will notify
        you within <strong>72 hours</strong>, following international best practice.
      </p>

      <h2 id="menores">11. Minors</h2>
      <p>
        Chalyb is not aimed at anyone under 18. We do not knowingly collect data from minors. If we
        find that we hold a minor’s data without parental or guardian authorisation, we delete it
        immediately. If you are a parent or guardian and believe the minor in your care gave us
        data, contact us via <Link href={'/contacto' as Route}>/contacto</Link> and we will sort it
        out.
      </p>

      <h2 id="cambios">12. Changes to this notice</h2>
      <p>
        We may update this notice when our practices or the applicable regulations change. For
        substantial changes (new providers, new purposes, changes to international transfers):
      </p>
      <ul>
        <li>We notify you by email at least 14 calendar days in advance.</li>
        <li>We publish the new version on this page with an updated date.</li>
        <li>
          If the changes affect secondary purposes, you will have the option to object before they
          take effect.
        </li>
      </ul>

      <h2 id="contacto">13. Contact</h2>
      <p>For any question, to exercise ARCO rights, or to report privacy incidents:</p>
      <ul>
        <li>
          Form: <Link href={'/contacto' as Route}>/contacto</Link>
        </li>
        <li>Suggested subject: «Privacy — [your reason]»</li>
      </ul>
      <p>
        We respond within <strong>20 business days</strong> for formal ARCO requests and in under 24
        business hours for general questions.
      </p>

      <div className="legal-callout" style={{ marginTop: 40 }}>
        <strong>About this document:</strong> this version meets the minimum LFPDPPP requirements
        for a multi-engine SaaS in Mexico. If you are going to handle health data, sensitive
        financial data, or minors’ data directly, appoint a Privacy Officer and run an impact
        assessment specific to those cases.
      </div>
    </>
  );
}
