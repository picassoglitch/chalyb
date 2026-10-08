import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

/** Keys under chalito.meta in src/lib/chalito/messages/*.json. */
export type ChalitoPage =
  | 'home' | 'settings' | 'inbox' | 'onboarding' | 'connectors' | 'credits' | 'download'
  | 'devices' | 'addDevice' | 'mesas' | 'mesa' | 'rooms' | 'room' | 'sessions' | 'newSession'
  | 'session' | 'store' | 'character' | 'usage' | 'link' | 'approval' | 'notification' | 'consent';

/**
 * generateMetadata for a Chalito page: its localized tab title ("Ajustes de Chalito · Chalyb",
 * through the root "%s · Chalyb" template). Without it a subpage fell back to the marketing tagline.
 */
export const chalitoMetadata =
  (page: ChalitoPage, extra: Metadata = {}) =>
  async ({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> => {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'chalito.meta' });
    return { ...extra, title: t(page) };
  };
