import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthHomeLink } from '@/components/auth/auth-home-link';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.resetPassword' });
  return { title: t('title') };
}

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
    <main className="chalyb-app auth-shell">
      <AuthHomeLink />

      <div className="auth-card">
        <h1 className="auth-inbox-title">
          {t('title')}
        </h1>
        <ResetPasswordForm tokenHash={token_hash} />
      </div>
    </main>
  );
}
