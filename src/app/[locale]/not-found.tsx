import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth/session';
import { PublicNav } from '@/components/public/public-nav';
import { PublicFooter } from '@/components/public/public-footer';
import '@/styles/chalyb-tokens.css';
import '@/styles/chalyb-public.css';

// The not-found page for every locale route: an unknown path (via
// [...rest]) and any page that calls notFound(). In the public site's chrome,
// with a way back to the home page and to help.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('notFound');
  return { title: t('metaTitle'), robots: { index: false } };
}

export default async function NotFound() {
  const t = await getTranslations('notFound');
  const user = await getCurrentUser().catch(() => null);
  return (
    <div className="chalyb-app pub">
      <PublicNav signedIn={user !== null} />
      <main id="main" style={{ padding: '64px 16px 80px' }}>
        <div className="ch-card" style={{ maxWidth: 560, margin: '0 auto', padding: 32, display: 'grid', gap: 16 }}>
          <h1 className="ch-h1">{t('title')}</h1>
          <p className="ch-sub">{t('lead')}</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href={user ? '/app' : '/'} className="ch-btn ch-btn--primary">
              {user ? t('app') : t('home')}
            </Link>
            <Link href="/contacto" className="ch-btn ch-btn--secondary">
              {t('help')}
            </Link>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
