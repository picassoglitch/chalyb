import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';

/** The way back to the site from the auth screens (sign-in/up, forgot and
 *  reset password), in the pill the old "Plataforma en vivo" badge used. */
export async function AuthHomeLink() {
  const t = await getTranslations('auth');
  return (
    <Link href="/" className="auth-status" data-auth="home">
      ← {t('backHome')}
    </Link>
  );
}
