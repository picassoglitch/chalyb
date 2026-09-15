import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Route } from 'next';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { safeNextPath } from '@/lib/auth/safe-next';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { EmailAuthForm } from '@/components/auth/email-auth-form';
import { BrandMark } from '@/components/landing/brand-mark';

// Landing pricing cards link to /sign-in?mode=signup&plan=<tier>. Map the
// chosen plan to where the user needs to BE after auth: Free lands in the
// workspace, paid tiers land on the subscription page where the plan cards
// (and the in-app card checkout) live. An explicit ?next= always wins.
const PLAN_NEXT: Record<string, string> = {
  free: '/app',
  pro: '/app/subscription',
  vip: '/app/subscription',
};

// On-brand auth: the Chalyb mark + a way back home above the card, Google
// first (the fastest path), email below. No orphan card, no "platform live"
// claim — the status pill states what Chalyb is, not what is running.
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
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { error, next: rawNext, mode, reset, plan } = await searchParams;
  const next = rawNext ?? (plan ? PLAN_NEXT[plan.toLowerCase()] : undefined);
  const t = await getTranslations('auth.signIn');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    // safeNextPath is the shared allowlist (same one /auth/callback uses) so
    // this can't be used as an open redirect.
    const safeNext = safeNextPath(next, '/account');
    redirect(safeNext as Route);
  }

  const upstreamError =
    error === 'missing_code' ? t('errorMissingCode') : error ? t('errorGeneric') : null;
  const initialMode = mode === 'signup' ? 'signup' : 'signin';

  return (
    <main className="auth-shell">
      <div className="auth-brandbar">
        <Link href={'/' as Route} className="auth-brand" aria-label="Chalyb">
          <BrandMark size={22} />
          <span>CHALYB</span>
        </Link>
        <Link href={'/' as Route} className="auth-back">
          {t('backHome')}
        </Link>
      </div>

      <div className="auth-status">
        <span className="auth-status-dot" />
        {t('liveStatus')}
      </div>

      <div className="auth-card">
        {reset === 'success' && <div className="auth-success">{t('resetSuccess')}</div>}

        <div className="auth-section-primary">
          <p className="auth-kicker">
            {initialMode === 'signup' ? t('newTitle') : t('returningTitle')}
          </p>
          <h1 className="auth-headline">
            {initialMode === 'signup' ? t('signupTitle') : t('title')}
          </h1>
          <GoogleSignInButton next={next} variant="premium" />
        </div>

        {upstreamError && <div className="auth-error auth-error-upstream">{upstreamError}</div>}

        <div className="auth-divider">
          <span>{t('orDivider')}</span>
        </div>

        <EmailAuthForm initialMode={initialMode} next={next} showModeTabs />

        <ul className="auth-benefits auth-benefits-compact">
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

      <p className="auth-fine">{t('fine')}</p>
    </main>
  );
}
