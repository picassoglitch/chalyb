import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

// 4 · Galería (LANDING-SPEC §3.5): 6 example clips, vertical with a big
// subtitle and the duration, as on the "Tus clips están listos" screen. The
// stills are AI-generated examples (public/landing/clip-N.webp), said once in
// the footnote. Shown only while Clips is active. Lazy next/images, not the
// .pub-thumb CSS backgrounds: those downloaded all six at full size on first
// load, next to the hero's LCP image (LANDING-SPEC §7).

const CLIPS = [
  { n: '1', dur: '0:42' },
  { n: '2', dur: '0:28' },
  { n: '3', dur: '0:35' },
  { n: '4', dur: '0:51' },
  { n: '5', dur: '0:19' },
  { n: '6', dur: '0:47' },
] as const;

export async function Gallery() {
  const t = await getTranslations('landing.gallery');
  return (
    <section className="pub-band pub-band--white" aria-labelledby="gallery-title">
      <div className="pub-wrap">
        <div className="pub-shd">
          <p className="ch-label">{t('label')}</p>
          <h2 id="gallery-title">{t('title')}</h2>
          <p>
            <span className="pub-only-desk">{t('sub')}</span>
            <span className="pub-only-mob">{t('subMobile')}</span>
          </p>
        </div>
        {/* A horizontal carousel on phones: focusable so it scrolls by keyboard. */}
        <ul className="pub-gall2" tabIndex={0} aria-label={t('title')}>
          {CLIPS.map(({ n, dur }) => (
            <li key={n} className="pub-gall2__c">
              <div className={`pub-thumb pub-thumb--${n} pub-gall2__v`} aria-hidden="true">
                <Image
                  src={`/landing/clip-${n}.webp`}
                  alt=""
                  fill
                  sizes="(max-width: 767px) 136px, 200px"
                  loading="lazy"
                  className="pub-gall2__img"
                />
                <span className="pub-gall2__dur">{dur}</span>
                <span className="pub-gall2__cap">{t(`cap${n}`)}</span>
              </div>
              <b>{t(`c${n}`)}</b>
              <small>{t('format')}</small>
            </li>
          ))}
        </ul>
        <div className="pub-gall2__foot">
          <ul aria-label={t('platforms')} className="pub-gall2__plat">
            {(['p1', 'p2', 'p3'] as const).map((k) => (
              <li key={k}>{t(k)}</li>
            ))}
          </ul>
          <p>{t('foot')}</p>
        </div>
      </div>
    </section>
  );
}
