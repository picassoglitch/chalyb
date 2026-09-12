import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Route } from 'next';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { EmailAuthForm } from '@/components/auth/email-auth-form';

// Landing pricing cards link to /sign-in?mode=signup&plan=<tier>. Map the
// chosen plan to where the user needs to BE after auth: Free lands in the
// workspace, paid tiers land on billing where Mercado Pago checkout lives.
// An explicit ?next= always wins over the plan-derived default.
const PLAN_NEXT: Record<string, string> = {
  free: '/app',
  pro: '/app/billing',
  vip: '/app/billing',
};

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
    // Honor `?next=` so the landing-page pricing CTA flow works:
    // anon clicks "Pasar a Pro" → /sign-in?next=/app/billing → user signs in →
    // lands on /app/billing instead of the generic /account. Only accept
    // same-origin relative paths so we don't get used as an open redirect —
    // including the `/\evil.com` variant (browsers normalize `\` to `/`,
    // turning it protocol-relative).
    const safeNext =
      typeof next === 'string' &&
      next.startsWith('/') &&
      !next.startsWith('//') &&
      !next.includes('\\')
        ? next
        : '/account';
    // typedRoutes can't statically know what `next` is — cast through
    // Route since we've already validated it's a same-origin path.
    redirect(safeNext as Route);
  }

  const upstreamError =
    error === 'missing_code' ? t('errorMissingCode') : error ? t('errorGeneric') : null;
  const initialMode = mode === 'signup' ? 'signup' : 'signin';

  return (
    <main className="auth-shell">
      <div className="auth-status">
        <span className="auth-status-dot" />
        {t('liveStatus')}
      </div>

      <div className="auth-card">
        {reset === 'success' && <div className="auth-success">{t('resetSuccess')}</div>}

        <EmailAuthForm initialMode={initialMode} next={next} showModeTabs />

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

      <p className="auth-fine">{t('fine')}</p>
    </main>
  );
}
