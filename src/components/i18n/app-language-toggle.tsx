'use client';

// In-app language toggle: same page in the other language, saved to the
// profile so the next sign-in (/account) opens the app in it.

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { Globe } from 'lucide-react';
import { usePathname, useRouter, routing } from '@/i18n/routing';
import { setPreferredLocale } from '@/lib/auth/locale-actions';

const LABELS: Record<string, string> = { es: 'Español', en: 'English' };

export function AppLanguageToggle({ compact = false }: { compact?: boolean }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, start] = useTransition();
  const target = routing.locales.find((l) => l !== locale) ?? routing.defaultLocale;

  const onClick = () =>
    start(async () => {
      // A failed save still switches the page: the URL decides the language.
      await setPreferredLocale(target).catch(() => undefined);
      router.replace(`${pathname}${window.location.search}` as never, { locale: target });
    });

  return (
    <button
      type="button"
      className={compact ? 'ch-lang ch-lang--icon' : 'ch-lang ch-lang--row'}
      onClick={onClick}
      disabled={pending}
      lang={target}
      aria-label={LABELS[target]}
      title={LABELS[target]}
      data-lang-toggle={target}
    >
      {/* No icon in the mobile header: with it, 320px scrolls sideways. */}
      {!compact && <Globe aria-hidden="true" />}
      {compact ? target.toUpperCase() : LABELS[target]}
    </button>
  );
}
