'use client';

// "Conecta tu encoder": the RTMP server, the stream key (masked until
// "Mostrar") and the one-field URL for cameras. Same data as the engine's
// encoder panel; the key comes only from the reveal call.

import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import { BookOpen } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { fullRtmpUrl } from '@/lib/tools/envivo-platforms';
import { ReauthSheet, useKeyReveal, ValueRow } from './stream-key';

export function EncoderCard({
  rtmpUrl,
  next,
  guide = true,
}: {
  rtmpUrl: string;
  /** This screen's path, for "Volver a iniciar sesión". */
  next: string;
  guide?: boolean;
}) {
  const t = useTranslations('liveTool.encoder');
  const ts = useTranslations('liveTool.settings');
  const r = useKeyReveal('ingest');
  const secret = {
    shown: r.key !== null,
    busy: r.busy,
    onShow: () => void r.reveal(''),
    onHide: r.hide,
  };
  return (
    <section className="ch-ev-enc" aria-labelledby="enc-t">
      <h2 id="enc-t" className="ch-h3">
        {t('title')}
      </h2>
      <p className="ch-muted">{t('sub')}</p>
      <ValueRow id="enc-server" label={t('server')} value={rtmpUrl} />
      <ValueRow id="enc-key" label={t('key')} value={r.key} secret={secret} />
      <ValueRow
        id="enc-full"
        label={t('full')}
        value={r.key === null ? null : fullRtmpUrl(rtmpUrl, r.key)}
        secret={secret}
        note={t('fullNote')}
      />
      {r.error && !r.ask && (
        <p role="alert" className="ch-ev-err">
          {r.error === 'limit' ? ts('revealLimit') : ts('saveError')}
        </p>
      )}
      {guide && (
        <Link href={'/app/en-vivo/conectar' as Route} className="ch-lnk ch-ev-enc__guide">
          <BookOpen aria-hidden="true" />
          {t('guide')}
        </Link>
      )}
      <ReauthSheet r={r} next={next} />
    </section>
  );
}
