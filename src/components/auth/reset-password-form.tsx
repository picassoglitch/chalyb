'use client';

import { useState, useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, routing } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';

/**
 * Reset password. The email link lands here with a `token_hash` in the URL and
 * creates NO session — clicking it never logs anyone in. The token is verified
 * only when the user submits a new password; we use that momentary session for
 * the single updateUser call and then sign out, so nobody ends up logged into
 * the app without going through sign-in. If the user never submits, nothing
 * happens at all.
 */
export function ResetPasswordForm({ tokenHash }: { tokenHash?: string }) {
  const t = useTranslations('auth.resetPassword');
  const locale = useLocale();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError(t('errorWeakPassword'));
      return;
    }
    if (password !== confirm) {
      setError(t('errorMismatch'));
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      // Verify the recovery token ONLY now — this is the first moment a session
      // exists, and it's gone again a few lines down.
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        type: 'recovery',
        token_hash: tokenHash as string,
      });
      if (verifyErr) {
        setInvalid(true);
        return;
      }

      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) {
        // The token is consumed now; tear down the transient session so a failed
        // update can't leave anyone logged in. They'll request a fresh link.
        await supabase.auth.signOut();
        if (updErr.code === 'same_password') setError(t('errorSamePassword'));
        else if (updErr.code === 'weak_password') setError(t('errorWeakPassword'));
        else setError(updErr.message || t('errorGeneric'));
        return;
      }

      // Done. End the session — no auto-login — and send them to sign in with
      // their NEW password. Full navigation so the cleared session is in effect.
      await supabase.auth.signOut();
      setDone(true);
      // 'as-needed' prefixing: the default locale has no prefix; others do.
      const prefix = locale === routing.defaultLocale ? '' : `/${locale}`;
      window.location.assign(`${prefix}/sign-in?reset=success`);
    });
  }

  // No token in the link (or it was rejected) → there's nothing to do here and
  // no session was ever created. Offer a fresh link.
  if (!tokenHash || invalid) {
    return (
      <div className="auth-inbox-success">
        <div
          className="auth-inbox-icon"
          style={{ borderColor: '#e0564f', color: '#e0564f', background: 'rgba(224, 86, 79, 0.12)' }}
        >
          !
        </div>
        <h3 className="auth-inbox-title">{t('invalidTitle')}</h3>
        <p className="auth-inbox-body">{t('invalidBody')}</p>
        <Link href="/forgot-password" className="auth-mode-switch-link">
          {t('requestNew')}
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="auth-inbox-success">
        <div className="auth-inbox-icon">✓</div>
        <h3 className="auth-inbox-title">{t('successTitle')}</h3>
        <p className="auth-inbox-body">{t('successBody')}</p>
      </div>
    );
  }

  return (
    <form className="auth-email-form" onSubmit={handleSubmit} noValidate>
      <p className="auth-inbox-body" style={{ maxWidth: 'none', textAlign: 'left' }}>
        {t('intro')}
      </p>

      <div className="auth-field">
        <label htmlFor="auth-password">{t('passwordLabel')}</label>
        <input
          id="auth-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('passwordPlaceholder')}
        />
      </div>

      <div className="auth-field">
        <label htmlFor="auth-password-confirm">{t('confirmLabel')}</label>
        <input
          id="auth-password-confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={t('passwordPlaceholder')}
        />
      </div>

      {error && <div className="auth-error">{error}</div>}

      <button type="submit" className="auth-submit" disabled={pending}>
        {pending ? '...' : t('submit')}
      </button>
    </form>
  );
}
