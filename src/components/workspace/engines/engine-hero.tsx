'use client';

import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

// Single focused continuation hero. ONE primary action only:
//   - has a live/in-progress engine  → "Continuar →" resumes it (by name)
//   - otherwise                      → "Abrir ChalybClip →" (the ready-now engine)
// Plus one low-emphasis "Ver demo" text link. The "Actualizar a Pro" upsell
// lives down in the Pro section now — it no longer competes up here.

// Near-black ink for the solid brand-green button — inline so it always wins
// over inherited light page text.
const INK = '#0a0c0e';

export function EngineHero({
  liveCount,
  continueEngine,
}: {
  liveCount: number;
  continueEngine: { name: string; slug: string } | null;
}) {
  const t = useTranslations('engines');
  const primaryHref = (
    continueEngine ? `/app/engines/${continueEngine.slug}` : '/app/engines/chalybclip'
  ) as Route;

  return (
    <section className="relative overflow-hidden rounded-[18px] border border-[var(--cc-line)] bg-[var(--cc-panel)]/70 p-7 backdrop-blur-xl sm:p-9">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-28 -top-28 size-80 rounded-full bg-[var(--cc-green-g)] blur-3xl"
      />
      <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <div className="min-w-0 max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--cc-green)]/30 bg-[var(--cc-green-g)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--cc-green)]">
            <span className="size-1.5 rounded-full bg-[var(--cc-green)]" />
            {liveCount > 0 ? t('hero.badgeLive', { count: liveCount }) : t('hero.badgeIdle')}
          </span>
          <h1
            className="mt-4 text-[clamp(22px,3vw,32px)] font-bold leading-[1.1] tracking-tight text-[var(--cc-txt)]"
            style={{ fontFamily: 'var(--cc-disp), sans-serif' }}
          >
            {continueEngine ? t('hero.headingContinue') : t('hero.headingStart')}
          </h1>
          <p className="mt-2.5 text-[14px] leading-relaxed text-[var(--cc-txt-2)]">
            {continueEngine
              ? t('hero.subContinue', { name: continueEngine.name })
              : t('hero.subStart')}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-3">
          <Link
            href={primaryHref}
            style={{ color: INK }}
            className="rounded-xl bg-[var(--cc-green)] px-6 py-3 text-[14px] font-bold transition-[filter] hover:brightness-110"
          >
            {continueEngine ? t('hero.ctaContinue') : t('hero.ctaOpen')}
          </Link>
          <Link
            href={'/app/engines/chalybclip' as Route}
            className="text-[13.5px] font-medium text-[var(--cc-txt-2)] underline-offset-4 transition-colors hover:text-[var(--cc-txt)] hover:underline"
          >
            {t('hero.ctaDemo')}
          </Link>
        </div>
      </div>
    </section>
  );
}
