import { getTranslations } from 'next-intl/server';
import { Lightbulb } from 'lucide-react';
import { partnerProgramTermsUrl } from '@/lib/config/flags';
import { IdeaForm } from '@/components/public/idea-form';

// 7 · Socios (#idea). BUILD-SPEC's sub verbatim, with no percentage or amount
// until the program has terms (D7/Q18); "Ver bases" appears only with
// PARTNER_PROGRAM_TERMS_URL. The "Proponer una idea" form lives here (P4-6).

export async function Partner() {
  const t = await getTranslations('landing.partner');
  const terms = partnerProgramTermsUrl();
  return (
    <section id="idea" className="pub-band" aria-labelledby="partner-title">
      <div className="pub-wrap pub-partner">
        <div className="pub-partner__copy">
          <span className="pub-partner__ic" aria-hidden="true">
            <Lightbulb />
          </span>
          <p className="ch-label">{t('label')}</p>
          <h2 id="partner-title">{t('title')}</h2>
          <p>{t('sub')}</p>
          {terms && (
            <a href={terms} className="ch-lnk" target="_blank" rel="noopener noreferrer">
              {t('terms')}
            </a>
          )}
        </div>
        <div className="pub-partner__form">
          <IdeaForm />
        </div>
      </div>
    </section>
  );
}
