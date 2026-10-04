import { getTranslations } from 'next-intl/server';
import { Lightbulb } from 'lucide-react';
import { PartnerSheet } from './partner-sheet';

// 8 · Socios (#idea, LANDING-SPEC §3.9): a light strip, always after Precios
// and the FAQ. The idea form opens in a sheet; no promise of earnings until
// the program has terms (D7).

export async function Partner() {
  const t = await getTranslations('landing.partner');
  return (
    <section id="idea" className="pub-band pub-band--tight" aria-labelledby="partner-title">
      <div className="pub-wrap">
        <div className="pub-pstrip">
          <span className="pub-pstrip__ic" aria-hidden="true">
            <Lightbulb />
          </span>
          <div className="pub-pstrip__tx">
            <p className="ch-label">{t('label')}</p>
            <h2 id="partner-title">{t('title')}</h2>
            <p>{t('sub')}</p>
          </div>
          <PartnerSheet label={t('open')} title={t('sheetTitle')} close={t('close')} />
        </div>
      </div>
    </section>
  );
}
