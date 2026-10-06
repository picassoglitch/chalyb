import { getTranslations } from 'next-intl/server';
import { PublicNav } from '@/components/public/public-nav';
import { PublicFooter } from '@/components/public/public-footer';
import { ContactForm } from './contact-form';
import '@/styles/chalyb-tokens.css';
import '@/styles/chalyb-public.css';
import '@/styles/chalyb-legal.css';

// /contacto in the public site's chrome (PublicNav + PublicFooter), the same
// as the landing and /planes. The form keeps its .auth-* markup, styled for
// the light theme in chalyb-legal.css.

export async function ContactPage({
  isAuthenticated,
  category,
}: {
  isAuthenticated: boolean;
  category?: 'cobro';
}) {
  const t = await getTranslations('contact');

  return (
    <div className="chalyb-app pub">
      <PublicNav signedIn={isAuthenticated} />
      <main id="main" className="pub-doc">
        <div className="pub-doc__wrap" style={{ maxWidth: 680 }}>
          <header className="pub-doc__head">
            <p className="pub-doc__eyebrow">{t('eyebrow')}</p>
            <h1 className="ch-h1">{t('title')}</h1>
            <p className="ch-sub">{t('lead')}</p>
          </header>
          <div className="pub-doc__card">
            {category === 'cobro' && (
              <p style={{ margin: '0 0 18px', fontSize: 17, lineHeight: 1.55 }}>
                {t('cobroIntro')}
              </p>
            )}
            <ContactForm
              category={category}
              defaultSubject={category === 'cobro' ? t('cobroSubject') : undefined}
            />
          </div>
          <p className="pub-doc__notes">
            <span>{t('assurances.1')}</span>
            <span>{t('assurances.2')}</span>
            <span>{t('assurances.3')}</span>
          </p>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
