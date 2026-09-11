'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ENGINE_FILTER_KEYS,
  sectionFor,
  variantFor,
  type EngineFilterKey,
  type EngineVM,
} from './engine-config';
import { EngineHero } from './engine-hero';
import { UpgradeBanner } from './upgrade-banner';
import { EngineFilters } from './engine-filters';
import { EngineCard } from './engine-card';

// Client island for the engines hub. Owns the filter-tab + coming-soon-toggle
// state; all auth/tier/live-gating already happened on the server and arrives
// baked into each EngineVM.
//
// Default view ('all' filter) = the GROUPED layout: three actionability
// sections (Disponibles ahora / Desbloueá con Pro / Próximamente) so the one
// thing a user can do right now leads, and everything else is demoted. Picking
// a specific filter tab flattens to a plain grid for power users.

function CardGrid({ items }: { items: EngineVM[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((vm) => (
        <div key={vm.id} className={vm.featured ? 'col-span-full' : ''}>
          <EngineCard vm={vm} variant={variantFor(vm.state, vm.featured)} />
        </div>
      ))}
    </div>
  );
}

// Section header with a colored accent bar + a hairline divider underneath, so
// the three actionability groups read as clearly separate bands. `right` is an
// optional trailing control (used for the coming-soon toggle).
function SectionHead({
  title,
  sub,
  accent,
  right,
}: {
  title: string;
  sub?: string;
  accent: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="border-b border-[var(--cc-line)] pb-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`h-4 w-1.5 shrink-0 rounded-full ${accent}`} />
          <h2
            className="text-[15px] font-bold tracking-tight text-[var(--cc-txt)]"
            style={{ fontFamily: 'var(--cc-disp), sans-serif' }}
          >
            {title}
          </h2>
        </div>
        {right}
      </div>
      {sub && <p className="mt-1 pl-[18px] text-[12.5px] leading-relaxed text-[var(--cc-txt-3)]">{sub}</p>}
    </div>
  );
}

export function EnginesExplorer({
  engines,
  liveCount,
  continueEngine,
  tierLabel,
  showUpsell,
}: {
  engines: EngineVM[];
  liveCount: number;
  continueEngine: { name: string; slug: string } | null;
  tierLabel: string;
  showUpsell: boolean;
}) {
  const t = useTranslations('engines');
  const [filter, setFilter] = useState<EngineFilterKey>('all');
  const [soonOpen, setSoonOpen] = useState(false);

  const counts = useMemo(() => {
    const c = Object.fromEntries(ENGINE_FILTER_KEYS.map((k) => [k, 0])) as Record<
      EngineFilterKey,
      number
    >;
    for (const e of engines) for (const k of e.filterKeys) c[k] += 1;
    return c;
  }, [engines]);

  const groups = useMemo(() => {
    const available: EngineVM[] = [];
    const pro: EngineVM[] = [];
    const soon: EngineVM[] = [];
    for (const e of engines) {
      const s = sectionFor(e.state);
      (s === 'available' ? available : s === 'pro' ? pro : soon).push(e);
    }
    return { available, pro, soon };
  }, [engines]);

  const filtered = useMemo(
    () => engines.filter((e) => e.filterKeys.includes(filter)),
    [engines, filter],
  );

  return (
    <div className="flex flex-col gap-10 pb-2 md:gap-12">
      {/* Slim page title + tier badge */}
      <div className="flex items-center justify-between gap-3">
        <span
          className="text-[13px] font-semibold uppercase tracking-wider text-[var(--cc-txt-4)] [font-family:var(--cc-mono),monospace]"
        >
          {t('title')}
        </span>
        <span className="rounded-full border border-[var(--cc-green)]/30 bg-[var(--cc-green-g)] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[var(--cc-green)]">
          {tierLabel}
        </span>
      </div>

      <EngineHero liveCount={liveCount} continueEngine={continueEngine} />

      <div className="flex flex-col gap-10 md:gap-12">
        <EngineFilters active={filter} counts={counts} onChange={setFilter} />

        {filter !== 'all' ? (
          // ── Power-user filtered view: flat grid ──────────────────────────
          filtered.length === 0 ? (
            <EmptyFilter onReset={() => setFilter('all')} />
          ) : (
            <CardGrid items={filtered} />
          )
        ) : (
          // ── Default grouped view: three actionability sections ───────────
          <div className="flex flex-col gap-10 md:gap-12">
            {groups.available.length > 0 && (
              <section className="flex flex-col gap-5">
                <SectionHead
                  title={t('sections.available')}
                  sub={t('sections.availableSub')}
                  accent="bg-[var(--cc-green)]"
                />
                <CardGrid items={groups.available} />
              </section>
            )}

            {groups.pro.length > 0 && (
              <section className="flex flex-col gap-5">
                <SectionHead
                  title={t('sections.pro')}
                  sub={t('sections.proSub')}
                  accent="bg-[var(--cc-purple)]"
                />
                {showUpsell && <UpgradeBanner />}
                <CardGrid items={groups.pro} />
              </section>
            )}

            {groups.soon.length > 0 && (
              <section className="flex flex-col gap-5">
                <SectionHead
                  title={t('sections.soon')}
                  sub={t('sections.soonSub')}
                  accent="bg-[var(--cc-txt-4)]"
                  right={
                    <button
                      type="button"
                      onClick={() => setSoonOpen((v) => !v)}
                      aria-expanded={soonOpen}
                      className="shrink-0 rounded-lg border border-[var(--cc-line-2)] px-3 py-1.5 text-[12px] font-semibold text-[var(--cc-txt-3)] transition-colors hover:text-[var(--cc-txt)]"
                    >
                      {soonOpen
                        ? t('sections.soonHide')
                        : t('sections.soonShow', { count: groups.soon.length })}
                    </button>
                  }
                />
                {soonOpen && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {groups.soon.map((vm) => (
                      <EngineCard key={vm.id} vm={vm} variant="soon" />
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyFilter({ onReset }: { onReset: () => void }) {
  const t = useTranslations('engines.filters');
  return (
    <div className="rounded-[14px] border border-dashed border-[var(--cc-line-2)] p-12 text-center">
      <div className="text-[14px] font-semibold text-[var(--cc-txt-2)]">{t('emptyTitle')}</div>
      <button
        type="button"
        onClick={onReset}
        className="mt-3 rounded-lg border border-[var(--cc-line-2)] px-4 py-1.5 text-[12.5px] font-semibold text-[var(--cc-txt-3)] transition-colors hover:text-[var(--cc-txt)]"
      >
        {t('emptyCta')}
      </button>
    </div>
  );
}
