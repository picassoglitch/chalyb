import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token_hash } = await searchParams;
  const t = await getTranslations('auth.resetPassword');

  return (
    <main className="auth-shell">
      <div className="auth-status">
        <span className="auth-status-dot" />
        {t('liveStatus')}
      </div>

      <div className="auth-card">
        <h2 className="auth-inbox-title" style={{ marginBottom: 4 }}>
          {t('title')}
        </h2>
        <ResetPasswordForm tokenHash={token_hash} />
      </div>
    </main>
  );
}
