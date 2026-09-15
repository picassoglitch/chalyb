'use client';

import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import type { EngineHeroAction } from './engine-config';

// Single focused continuation hero with ONE primary action, decided on the
// server (deriveNextAction): open the live engine, pick a live engine, explore
// one in simulation, or — when the whole kit is still upcoming — see what's
// coming. It never points at an engine that cannot be opened.

// Near-black ink for the solid brand-green button — inline so it always wins
// over inherited light page text.
const INK = '#0a0c0e';

export function EngineHero({ action }: { action: EngineHeroAction }) {
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
            {action.badge}
          </span>
          <h1
            className="mt-4 text-[clamp(22px,3vw,32px)] font-bold leading-[1.1] tracking-tight text-[var(--cc-txt)]"
            style={{ fontFamily: 'var(--cc-disp), sans-serif' }}
          >
            {action.heading}
          </h1>
          <p className="mt-2.5 text-[14px] leading-relaxed text-[var(--cc-txt-2)]">{action.sub}</p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-3">
          <Link
            href={action.href as Route}
            style={{ color: INK }}
            className="rounded-xl bg-[var(--cc-green)] px-6 py-3 text-[14px] font-bold transition-[filter] hover:brightness-110"
          >
            {action.ctaLabel}
          </Link>
          {action.secondaryLabel && action.secondaryHref && (
            <Link
              href={action.secondaryHref as Route}
              className="text-[13.5px] font-medium text-[var(--cc-txt-2)] underline-offset-4 transition-colors hover:text-[var(--cc-txt)] hover:underline"
            >
              {action.secondaryLabel}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
