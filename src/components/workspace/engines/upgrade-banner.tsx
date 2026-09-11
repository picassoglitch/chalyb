'use client';

import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { Link } from '@/i18n/routing';

// Pro upsell at the HEAD of the "Desbloueá con Pro" section — next to the
// engines it unlocks, not competing with the hero's primary action. Shown for
// FREE users only (PRO/VIP already have live access). Purple = the premium /
// Pro brand accent (was amber, which read as muddy brown).

export function UpgradeBanner() {
  const t = useTranslations('engines.upsell');
  return (
    <div className="flex flex-col items-start gap-3 rounded-[14px] border border-[var(--cc-purple)]/25 bg-[linear-gradient(110deg,var(--cc-purple-g),transparent_62%)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex items-center gap-3.5">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--cc-purple)]/30 bg-[var(--cc-purple-g)] text-[var(--cc-purple)]"
          aria-hidden
        >
          <Sparkles size={18} strokeWidth={1.75} />
        </span>
        <div>
          <div className="text-[13.5px] font-semibold text-[var(--cc-txt)]">{t('title')}</div>
          <div className="text-[12.5px] text-[var(--cc-txt-2)]">{t('sub')}</div>
        </div>
      </div>
      <Link
        href={'/app/subscription' as Route}
        className="shrink-0 rounded-lg border border-[var(--cc-purple)]/45 bg-[var(--cc-purple-g)] px-4 py-2 text-[12.5px] font-bold text-[var(--cc-purple)] transition-colors hover:bg-[var(--cc-purple)]/20"
      >
        {t('cta')}
      </Link>
    </div>
  );
}
