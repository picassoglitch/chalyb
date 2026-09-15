import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth/session';
import { LandingNav } from '@/components/landing/nav';
import { LandingFooter } from '@/components/landing/footer';
import { ContactForm } from '@/components/contact/contact-form';
import { signupHref } from '@/components/landing/links';

// /partners — the "tienes la idea, nosotros la construimos" stub.
//
// Deliberately minimal and honest: a short explanation, the three steps, and
// a WORKING intake (the same contact form that lands in the admin inbox and
// Resend, tagged pane=partner so it is filterable). No partner dashboard, no
// revenue-share backend, no engine pipeline, no fake success state — the form
// only says "received" when the server action actually accepted the message.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'partners' });
  return { title: t('metaTitle'), description: t('metaDescription') };
}

export default async function PartnersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [user, t] = await Promise.all([getCurrentUser(), getTranslations('partners')]);

  return (
    <div className="lp">
      <LandingNav isAuthenticated={user !== null} />

      <main className="lp-partners">
        <div className="lp-container lp-partners-inner">
          <header className="lp-partners-head">
            <p className="lp-kicker">{t('eyebrow')}</p>
            <h1 className="lp-h1 lp-partners-h1">{t('title')}</h1>
            <p className="lp-lead lp-partners-lead">{t('lead')}</p>
          </header>

          <ol className="lp-steps lp-partners-steps">
            {[1, 2, 3].map((n) => (
              <li key={n} className="lp-step">
                <span className="lp-step-num">0{n}</span>
                <h3>{t(`steps.${n}.title`)}</h3>
                <p>{t(`steps.${n}.body`)}</p>
              </li>
            ))}
          </ol>

          <section className="lp-partners-form">
            <h2 className="lp-h2 lp-partners-h2">{t('formTitle')}</h2>
            <p className="lp-sub lp-partners-sub">{t('formLead')}</p>
            <div className="lp-partners-card">
              <ContactForm pane="partner" />
            </div>
            <p className="lp-micro lp-partners-honest">{t('honest')}</p>
          </section>

          <aside className="lp-partners-kit">
            <span>{t('backKit')}</span>
            <Link href={signupHref() as Route} className="lp-btn lp-btn-secondary lp-btn-sm">
              {t('backKitCta')}
            </Link>
          </aside>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
