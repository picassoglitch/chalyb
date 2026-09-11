'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';

type Mode = 'signin' | 'signup';

interface Props {
  initialMode?: Mode;
  next?: string;
  showModeTabs?: boolean;
}

const ACCOUNT_ROUTE = '/account' as Route;

export function EmailAuthForm({ initialMode = 'signin', next, showModeTabs = true }: Props) {
  const t = useTranslations('auth.signIn');
  const router = useRouter();
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
        router.push((next ?? ACCOUNT_ROUTE) as Route);
        router.refresh();
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback${
              next ? `?next=${encodeURIComponent(next)}` : ''
            }`,
          },
        });
        if (err) {
          setError(mapError(err.code, err.message));
          return;
        }
        // If email confirmation is required (Supabase default), no session is returned.
        if (data.session) {
          router.push((next ?? ACCOUNT_ROUTE) as Route);
          router.refresh();
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
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('passwordPlaceholder')}
        />
        {mode === 'signin' && (
          <Link href="/forgot-password" className="auth-forgot-link">
            {t('forgotPassword')}
          </Link>
        )}
      </div>

      {error && <div className="auth-error">{error}</div>}

      <button type="submit" className="auth-submit" disabled={pending}>
        {pending ? '...' : mode === 'signin' ? t('submitSignIn') : t('submitSignUp')}
      </button>

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
