import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthHomeLink } from '@/components/auth/auth-home-link';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.forgotPassword' });
  return { title: t('title') };
}

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth.forgotPassword');

  return (
    <main className="chalyb-app auth-shell">
      <AuthHomeLink />

      <div className="auth-card">
        <h1 className="auth-inbox-title">
          {t('title')}
        </h1>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
