import { getTranslations } from 'next-intl/server';
import { SectionHead } from './section-head';

// 4 · Galería: 6 gradient frames, tagged "Ejemplo" (P4-4). No photos, no
// real clips. Shown only while Clips is active.

const CLIPS = ['1', '2', '3', '4', '5', '6'] as const;

export async function Gallery() {
  const t = await getTranslations('landing');
  return (
    <section className="pub-band pub-band--white" aria-labelledby="gallery-title">
      <div className="pub-wrap">
        <SectionHead
          id="gallery-title"
          label={t('gallery.label')}
          title={t('gallery.title')}
          sub={t('gallery.sub')}
        />
        <ul className="pub-gall">
          {CLIPS.map((n) => {
            const title = t(`gallery.c${n}`);
            return (
              <li key={n} className="pub-gall__g">
                <div
                  className={`pub-thumb pub-thumb--${n}`}
                  role="img"
                  aria-label={t('gallery.alt', { titulo: title })}
                >
                  <span className="ch-tag-ej pub-thumb__tag">{t('hero.example')}</span>
                </div>
                <b>{title}</b>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
