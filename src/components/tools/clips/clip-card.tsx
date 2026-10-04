// One clip in a grid (TOOLS-SPEC §3 ClipCard): 9:16 frame, duration, title
// (2 lines max), "{fecha} · {Formato}". The whole card opens the detail.

import type { Route } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Play } from 'lucide-react';
import { Link } from '@/i18n/routing';
import type { ClipDetail } from '@/lib/tools/adapters/types';
import { mmss, relativeDay, thumbFor } from '@/lib/tools/clips-home';

export async function ClipCard({ clip, now }: { clip: ClipDetail; now: Date }) {
  const t = await getTranslations('clipsTool');
  const locale = await getLocale();
  const length = clip.trim.endS - clip.trim.startS;
  return (
    <li className="ch-clipcard">
      <Link
        href={`/app/clips/${encodeURIComponent(clip.id)}` as Route}
        aria-label={t('card.open', { titulo: clip.title })}
      >
        <span
          className="ch-clipcard__thumb"
          style={
            clip.thumbUrl
              ? { backgroundImage: `url(${clip.thumbUrl})` }
              : { background: thumbFor(clip.id) }
          }
          aria-hidden="true"
        >
          <span className="ch-clipcard__dur">{mmss(length)}</span>
          <span className="ch-clipcard__play">
            <Play />
          </span>
        </span>
        <span className="ch-clipcard__t">{clip.title}</span>
        <span className="ch-clipcard__m">
          {t('card.meta', {
            fecha: relativeDay(clip.createdAt, now, locale),
            formato: t(`format.${clip.format}`),
          })}
        </span>
      </Link>
    </li>
  );
}
