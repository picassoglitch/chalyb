import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthHomeLink } from '@/components/auth/auth-home-link';
import type { Route } from 'next';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { localizeNext, safeNextPath } from '@/lib/auth/safe-next';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { EmailAuthForm } from '@/components/auth/email-auth-form';
import { legalPublished, paidCheckoutEnabled, trialFlowEnabled } from '@/lib/config/flags';
import { signupNext } from '@/lib/billing/plans-cta';

// Plan cards link to /sign-in?mode=signup&(intent=trial|plan=<tier>)&interval=…;
// signupNext() maps that to where the user continues after auth. An explicit
// ?next= always wins over the plan-derived default.
const VISUALLY_HIDDEN: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
};

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ mode?: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { mode } = await searchParams;
  const t = await getTranslations({ locale, namespace: 'auth.signIn' });
  return { title: mode === 'signup' ? t('metaTitleSignup') : t('metaTitle') };
}

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    error?: string;
    next?: string;
    mode?: string;
    reset?: string;
    plan?: string;
    intent?: string;
    interval?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { error, next: rawNext, mode, reset, plan, intent, interval } = await searchParams;
  // A plan card's CTA (SCR-13 → SCR-14): after the account, the trial picker
  // or the plan's checkout, with the card's interval kept (K-2).
  // Validated once here: the email form and the Google button hand `next` to
  // the browser as-is, so an off-site value must never reach them.
  const wanted =
    rawNext ??
    signupNext({ intent, plan, interval, flow: trialFlowEnabled(), paid: paidCheckoutEnabled() });
  const next = wanted ? safeNextPath(wanted, '/account') : undefined;
  const t = await getTranslations('auth.signIn');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    // Honor `?next=` so the landing-page pricing CTA flow works:
    // anon clicks "Pasar a Pro" → /sign-in?next=/app/billing → user signs in →
    // lands on /app/billing instead of the generic /account. safeNextPath is
    // the shared allowlist (same one /auth/callback uses) so we can't get used
    // as an open redirect.
    // typedRoutes can't statically know what `next` is — cast through
    // Route since we've already validated it's a same-origin path.
    redirect(localizeNext(next ?? '/account', locale) as Route);
  }

  const upstreamError =
    error === 'missing_code' ? t('errorMissingCode') : error ? t('errorGeneric') : null;
  const initialMode = mode === 'signup' ? 'signup' : 'signin';

  // No browsewrap (aceptacion-ux §2): the line sits next to "Crear cuenta"
  // and cites only documents that are published — the new set once P6 turns
  // LEGAL_PUBLISH on, the current Terms and Privacy until then.
  const published = legalPublished();
  const link = (href: string) =>
    function LegalLink(chunks: React.ReactNode) {
      return (
        <a href={href} target="_blank" rel="noopener">
          {chunks}
        </a>
      );
    };
  const legalLine = published
    ? t.rich('legalPublished', {
        terminos: link('/terminos'),
        uso: link('/uso-aceptable'),
        privacidad: link('/privacidad'),
      })
    : t.rich('legalCurrent', {
        terminos: link('/legal/terms'),
        privacidad: link('/legal/privacy'),
      });

  return (
    <main className="chalyb-app auth-shell">
      <AuthHomeLink />

      <div className="auth-card">
        {/* The tabs say which form this is; the h1 names it for screen
            readers and the document outline. */}
        <h1 style={VISUALLY_HIDDEN}>
          {initialMode === 'signup' ? t('metaTitleSignup') : t('title')}
        </h1>
        {reset === 'success' && <div className="auth-success">{t('resetSuccess')}</div>}

        <EmailAuthForm initialMode={initialMode} next={next} showModeTabs legal={legalLine} />

        {upstreamError && <div className="auth-error auth-error-upstream">{upstreamError}</div>}

        <div className="auth-divider">
          <span>{t('orDivider')}</span>
        </div>

        <GoogleSignInButton next={next} variant="compact" />

        <ul className="auth-benefits">
          <li>
            <span className="ab-tick">✓</span>
            {t('benefits.1')}
          </li>
          <li>
            <span className="ab-tick">✓</span>
            {t('benefits.2')}
          </li>
          <li>
            <span className="ab-tick">✓</span>
            {t('benefits.3')}
          </li>
        </ul>

        <p className="auth-social-proof">{t('socialProof')}</p>
      </div>
    </main>
  );
}
