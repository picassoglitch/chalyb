'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';
import { recordSignupConsent } from '@/lib/billing/signup-consent';
import { localizeNext } from '@/lib/auth/safe-next';

type Mode = 'signin' | 'signup';

interface Props {
  initialMode?: Mode;
  next?: string;
  showModeTabs?: boolean;
  /** The sign-up legal line, rendered on the server (it cites only the
   *  documents that are published). Shown next to "Crear cuenta". */
  legal?: React.ReactNode;
}

/** New accounts need 8+ characters (SCR-13; Supabase policy is OPS-16).
 *  Existing accounts still sign in with what they set. */
const SIGNUP_MIN_PASSWORD = 8;

const ACCOUNT_ROUTE = '/account' as Route;

/** /auth/* are route handlers, not pages: /auth/launch/<slug> 302s into the
 *  engine's app. A client-side push would run them as an RSC fetch first
 *  (minting a token and provisioning for nothing) before falling back to a
 *  full load, so they get a full navigation straight away. */
function useGoNext(next: string | undefined, locale: string) {
  const router = useRouter();
  return () => {
    if (next?.startsWith('/auth/')) {
      window.location.assign(next);
      return;
    }
    // `next` is locale-free (see proxy.ts); put the reader's prefix back.
    router.push(localizeNext(next ?? ACCOUNT_ROUTE, locale) as Route);
    router.refresh();
  };
}

export function EmailAuthForm({ initialMode = 'signin', next, showModeTabs = true, legal }: Props) {
  const t = useTranslations('auth.signIn');
  const locale = useLocale();
  const [name, setName] = useState('');
  const [marketing, setMarketing] = useState(false);
  const goNext = useGoNext(next, locale);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checkInboxEmail, setCheckInboxEmail] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function mapError(code: string | undefined, message: string): string {
    switch (code) {
      case 'invalid_credentials':
        return t('errorInvalidCredentials');
      case 'user_already_exists':
      case 'email_exists':
        return t('errorEmailExists');
      case 'weak_password':
        return t('errorWeakPassword');
      case 'email_not_confirmed':
        return t('errorEmailNotConfirmed');
      case 'over_email_send_rate_limit':
      case 'over_request_rate_limit':
        return t('errorRateLimit');
      default:
        return message || t('errorGeneric');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCheckInboxEmail(null);

    if (mode === 'signup' && password.length < SIGNUP_MIN_PASSWORD) {
      setError(t('errorShortPassword'));
      return;
    }
    if (password.length < 6) {
      setError(t('errorWeakPassword'));
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      if (mode === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) {
          setError(mapError(err.code, err.message));
          return;
        }
        goNext();
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: name.trim() ? { full_name: name.trim() } : undefined,
            // The confirmation link lands on /auth/callback, outside the
            // locale tree: carry the reader's prefix in `next`.
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
              localizeNext(next ?? ACCOUNT_ROUTE, locale),
            )}`,
          },
        });
        if (err) {
          setError(mapError(err.code, err.message));
          return;
        }
        // Evidence of what they accepted (and the marketing choice). The
        // account exists now even before the email is confirmed.
        if (data.user?.id) {
          await recordSignupConsent({
            userId: data.user.id,
            marketing,
            locale,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
            surface: 'web_signup_email',
          }).catch(() => {});
        }
        // If email confirmation is required (Supabase default), no session is returned.
        if (data.session) {
          goNext();
        } else {
          setCheckInboxEmail(email);
        }
      }
    });
  }

  if (checkInboxEmail) {
    return (
      <div className="auth-inbox-success">
        <div className="auth-inbox-icon">✓</div>
        <h3 className="auth-inbox-title">{t('checkInboxTitle')}</h3>
        <p className="auth-inbox-body">{t('checkInboxBody', { email: checkInboxEmail })}</p>
      </div>
    );
  }

  return (
    <form className="auth-email-form" onSubmit={handleSubmit} noValidate>
      {showModeTabs && (
        <div className="auth-mode-tabs">
          <button
            type="button"
            className={`auth-mode-tab${mode === 'signin' ? ' active' : ''}`}
            onClick={() => {
              setMode('signin');
              setError(null);
            }}
          >
            {t('tabSignIn')}
          </button>
          <button
            type="button"
            className={`auth-mode-tab${mode === 'signup' ? ' active' : ''}`}
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
          >
            {t('tabSignUp')}
          </button>
        </div>
      )}

      {mode === 'signup' && (
        <div className="auth-field">
          <label htmlFor="auth-name">{t('nameLabel')}</label>
          <input
            id="auth-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      )}

      <div className="auth-field">
        <label htmlFor="auth-email">{t('emailLabel')}</label>
        <input
          id="auth-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('emailPlaceholder')}
        />
      </div>

      <div className="auth-field">
        <label htmlFor="auth-password">{t('passwordLabel')}</label>
        <input
          id="auth-password"
          type="password"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          required
          minLength={mode === 'signup' ? SIGNUP_MIN_PASSWORD : 6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('passwordPlaceholder')}
          aria-describedby={mode === 'signup' ? 'auth-password-hint' : undefined}
        />
        {mode === 'signup' && (
          <p id="auth-password-hint" className="auth-hint">
            {t('passwordHintSignup')}
          </p>
        )}
        {mode === 'signin' && (
          <Link href="/forgot-password" className="auth-forgot-link">
            {t('forgotPassword')}
          </Link>
        )}
      </div>

      {mode === 'signup' && (
        <label className="auth-check">
          <input
            type="checkbox"
            checked={marketing}
            onChange={(e) => setMarketing(e.target.checked)}
          />
          <span>{t('marketing')}</span>
        </label>
      )}

      {error && <div className="auth-error">{error}</div>}

      <button type="submit" className="auth-submit" disabled={pending}>
        {pending
          ? mode === 'signup'
            ? t('creating')
            : '...'
          : mode === 'signin'
            ? t('submitSignIn')
            : t('submitSignUp')}
      </button>
      {mode === 'signup' && legal && <p className="auth-legal">{legal}</p>}

      {!showModeTabs && (
        <p className="auth-mode-switch">
          {mode === 'signin' ? t('noAccount') : t('hasAccount')}{' '}
          <button
            type="button"
            className="auth-mode-switch-link"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError(null);
            }}
          >
            {mode === 'signin' ? t('switchToSignUp') : t('switchToSignIn')}
          </button>
        </p>
      )}
    </form>
  );
}
