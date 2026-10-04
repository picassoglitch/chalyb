'use client';

// Paired computer not online (TOOLS-SPEC §6.2): "Tu computadora no está
// conectada" + one button that checks again in place.

import { useTransition } from 'react';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import { Laptop, RotateCw } from 'lucide-react';
import { Link, useRouter } from '@/i18n/routing';

export function DeviceOffline() {
  const t = useTranslations('liveTool.room');
  const ts = useTranslations('liveTool.settings');
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <section className="ch-card ch-state" aria-labelledby="offline-t">
      <span className="ch-state__ic" aria-hidden="true">
        <Laptop />
      </span>
      <h2 id="offline-t" className="ch-h2">
        {t('offlineTitle')}
      </h2>
      <p className="ch-muted">{t('offlineBody')}</p>
      <button
        type="button"
        className="ch-btn ch-btn--primary"
        disabled={pending}
        onClick={() => start(() => router.refresh())}
      >
        <RotateCw aria-hidden="true" />
        {t('offlineCta')}
      </button>
      <Link href={'/app/en-vivo/conectar' as Route} className="ch-lnk">
        {ts('addDevice')}
      </Link>
    </section>
  );
}
