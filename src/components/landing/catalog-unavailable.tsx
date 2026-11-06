import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Logo } from '@/components/ui/primitives';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { CookieSettingsButton } from '@/components/public/cookie-banner';

/** A missing catalog is not proof that a tool can be sold. Keep account
 *  access and support reachable without presenting trial or sales claims. */
export async function CatalogUnavailable({
  signedIn,
  embedded = false,
}: {
  signedIn: boolean;
  embedded?: boolean;
}) {
  const t = await getTranslations('landing');
  if (embedded) {
    // In the account, billing stays reachable: the banner and locked tools send payers here.
    const tw = await getTranslations('workspace.nav');
    return (
      <section
        className="ch-card"
        aria-labelledby="catalog-title"
        data-testid="catalog-unavailable"
      >
        <h1 id="catalog-title" className="ch-h1">
          {t('availability.title')}
        </h1>
        <p className="ch-sub">{t('availability.body')}</p>
        <Link href="/app/billing" className="ch-btn ch-btn--primary">
          {tw('billing')}
        </Link>{' '}
        <Link href="/contacto" className="ch-btn ch-btn--secondary">
          {t('publicFooter.write')}
        </Link>
      </section>
    );
  }
  const content = (
    <section className="pub-wrap" aria-labelledby="catalog-title" data-testid="catalog-unavailable">
      <h1 id="catalog-title">{t('availability.title')}</h1>
      <p>{t('availability.body')}</p>
      <Link href="/contacto" className="ch-btn ch-btn--secondary">
        {t('publicFooter.write')}
      </Link>
    </section>
  );
  return (
    <div className="chalyb-app pub">
      <a href="#main" className="ch-skip">
        {t('publicNav.skip')}
      </a>
      <header className="pub-nav">
        <Logo href="/" />
        <Link href={signedIn ? '/app' : '/sign-in'} className="ch-btn ch-btn--primary">
          {t(signedIn ? 'publicNav.app' : 'publicNav.login')}
        </Link>
      </header>
      <main id="main" className="pub-band">
        {content}
      </main>
      <footer className="pub-foot">
        <div className="pub-wrap pub-foot__bottom">
          <Link href="/legal/privacy">{t('publicFooter.legalDocs.privacy')}</Link>
          <CookieSettingsButton className="pub-foot__cookies" />
          <LanguageSwitcher />
        </div>
      </footer>
    </div>
  );
}
