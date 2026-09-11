'use client';

import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useWorkspace } from '@/lib/workspace/store';
import { LiveEngineSelectButton } from '@/components/workspace/live-engine-selector';
import { EngineGlyph } from './engine-glyph';
import type { EngineVM, EngineCardVariant } from './engine-config';

// Near-black ink for solid brand-green buttons — set inline so it always wins
// over inherited light page text.
const INK = '#0a0c0e';

// Engine tiles tuned for breathing room (Linear / Stripe / Vercel dashboard
// quality): generous padding (32px main · 24px grid · 20px mobile), category
// label ABOVE the title, relaxed line-height, and CTAs kept ≥24px off every
// border. Titles use normal tracking (never tight — that read as compressed).

function CategoryLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--cc-txt-4)] [font-family:var(--cc-mono),monospace]">
      {children}
    </div>
  );
}

function StatusBadge({ vm }: { vm: EngineVM }) {
  const t = useTranslations('engines.card');
  const map = {
    live: { label: t('statusLive'), dot: true, lock: false, cls: 'text-[var(--cc-green)] border-[var(--cc-green)]/40 bg-[var(--cc-green-g)]' },
    trial: { label: t('statusTrial'), dot: true, lock: false, cls: 'text-[var(--cc-cyan)] border-[var(--cc-cyan)]/40 bg-[var(--cc-cyan-g)]' },
    simulation: { label: t('statusSimulation'), dot: false, lock: false, cls: 'text-[var(--cc-txt-3)] border-[var(--cc-line-2)] bg-white/[0.02]' },
    locked: { label: vm.requiresPlanLabel ?? 'Pro', dot: false, lock: true, cls: 'text-[var(--cc-purple)] border-[var(--cc-purple)]/40 bg-[var(--cc-purple-g)]' },
    coming_soon: { label: t('statusSoon'), dot: false, lock: false, cls: 'text-[var(--cc-purple)] border-[var(--cc-purple)]/30 bg-[var(--cc-purple-g)]' },
  } as const;
  const s = map[vm.state];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold ${s.cls}`}>
      {s.dot && <span className="size-1.5 rounded-full bg-current" />}
      {s.lock && <Lock size={12} strokeWidth={2.25} />}
      {s.label}
    </span>
  );
}

function OwnerCaption({ vm }: { vm: EngineVM }) {
  const t = useTranslations('engines.card');
  const label = vm.isOwnedByMe
    ? t('ownerMine')
    : vm.isPlatformOwned
      ? t('ownerChalyb')
      : t('ownerBy', { owner: vm.ownerLabel });
  return (
    <span
      className={`truncate text-[10.5px] uppercase tracking-wider [font-family:var(--cc-mono),monospace] ${
        vm.isPlatformOwned ? 'text-[var(--cc-txt-4)]' : 'text-[var(--cc-purple)]'
      }`}
    >
      {label}
    </span>
  );
}

function EngineIcon({ vm, variant, box, glyph }: { vm: EngineVM; variant: EngineCardVariant; box: string; glyph: number }) {
  const tint =
    variant === 'locked'
      ? 'border-[var(--cc-purple)]/30 bg-[var(--cc-purple-g)] text-[var(--cc-purple)]'
      : variant === 'soon'
        ? 'border-[var(--cc-line-2)] bg-[var(--cc-bg-2)] text-[var(--cc-txt-4)]'
        : 'border-[var(--cc-green)]/30 bg-[var(--cc-green-g)] text-[var(--cc-green)]';
  return (
    <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-2xl border ${tint} ${box}`}>
      <EngineGlyph slug={vm.slug} size={glyph} />
    </span>
  );
}

// Feature list: 12px gap between items, ≥36px row height, relaxed line-height.
function Checkmarks({ bullets }: { bullets: string[] }) {
  return (
    <ul className="space-y-3">
      {bullets.slice(0, 3).map((b) => (
        <li key={b} className="flex min-h-9 items-center gap-3 text-[15px] leading-[1.6] text-[var(--cc-txt-2)]">
          <span className="shrink-0 text-[var(--cc-green)]">✓</span>
          <span>{b}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Coming-soon: compact row ───────────────────────────────────────────────
function SoonRow({ vm }: { vm: EngineVM }) {
  const t = useTranslations('engines.card');
  const showToast = useWorkspace((s) => s.showToast);
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[var(--cc-line)] bg-[var(--cc-panel)]/60 p-5 opacity-70 transition-opacity hover:opacity-100">
      <EngineIcon vm={vm} variant="soon" box="size-13" glyph={26} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold tracking-normal text-[var(--cc-txt-2)]">{vm.name}</div>
        <div className="mt-1 text-[11px] uppercase tracking-[0.08em] text-[var(--cc-txt-4)] [font-family:var(--cc-mono),monospace]">
          {vm.categoryLabel}
        </div>
      </div>
      <button
        type="button"
        onClick={() => showToast(t('notifyDone', { name: vm.name }))}
        className="shrink-0 rounded-lg border border-[var(--cc-line-2)] px-4 py-2 text-[12.5px] font-medium text-[var(--cc-txt-4)] transition-colors hover:text-[var(--cc-txt-2)]"
      >
        {t('notify')}
      </button>
    </div>
  );
}

// ── Featured: wide main card, content left / CTA right (≥32px gap) ──────────
function FeaturedCard({ vm, href }: { vm: EngineVM; href: Route }) {
  const t = useTranslations('engines.card');
  return (
    <article className="relative flex flex-col gap-8 rounded-[20px] border border-[var(--cc-green)]/45 bg-[linear-gradient(150deg,var(--cc-green-g),transparent_58%)] p-5 shadow-[0_18px_50px_-22px_var(--cc-green-g)] md:flex-row md:items-center md:justify-between md:gap-10 md:p-8">
      {/* LEFT — icon + a single text column so category, title, description and
          checkmarks all share ONE left edge (no ragged flush-to-border text). */}
      <div className="flex min-w-0 flex-1 items-start gap-5">
        <EngineIcon vm={vm} variant="featured" box="size-16 md:size-20" glyph={40} />
        <div className="min-w-0">
          <CategoryLabel>{vm.categoryLabel}</CategoryLabel>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h3 className="text-[26px] font-bold leading-[1.15] tracking-normal text-[var(--cc-txt)]" style={{ fontFamily: 'var(--cc-disp), sans-serif' }}>
              {vm.name}
            </h3>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--cc-green)]/40 bg-[var(--cc-green-g)] px-3 py-1 text-[11.5px] font-bold uppercase tracking-wide text-[var(--cc-green)]">
              <span className="size-1.5 rounded-full bg-[var(--cc-green)]" />
              {t('ribbon')}
            </span>
          </div>
          <p className="mt-3 max-w-[600px] text-[16px] leading-[1.7] text-[var(--cc-txt-2)]">{vm.tagline}</p>
          {vm.bullets.length > 0 && (
            <div className="mt-5">
              <Checkmarks bullets={vm.bullets} />
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — vertically centered, ≥32px (md:pl-8) from the content */}
      <div className="shrink-0 md:pl-8">
        <Link
          href={href}
          style={{ color: INK }}
          className="inline-flex rounded-xl bg-[var(--cc-green)] px-6 py-3.5 text-[15px] font-bold transition-[filter] hover:brightness-110"
        >
          {t('openNamed', { name: vm.name })}
        </Link>
      </div>
    </article>
  );
}

export function EngineCard({ vm, variant }: { vm: EngineVM; variant: EngineCardVariant }) {
  const t = useTranslations('engines.card');
  const href = `/app/engines/${vm.slug}` as Route;

  if (variant === 'soon') return <SoonRow vm={vm} />;
  if (variant === 'featured') return <FeaturedCard vm={vm} href={href} />;

  const isLocked = variant === 'locked';
  const showBullets = !isLocked && vm.bullets.length > 0;

  return (
    <article
      className={[
        'group relative flex h-full min-h-[208px] flex-col rounded-[20px] border p-5 transition-all duration-200 hover:-translate-y-0.5 md:p-6',
        isLocked
          ? 'border-[var(--cc-line)] bg-[var(--cc-panel)]/70 opacity-90 hover:opacity-100'
          : 'border-[var(--cc-green)]/20 bg-[var(--cc-panel)] hover:border-[var(--cc-green)]/40',
      ].join(' ')}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <EngineIcon vm={vm} variant={variant} box="size-16" glyph={32} />
          <div className="min-w-0">
            <CategoryLabel>{vm.categoryLabel}</CategoryLabel>
            <h3 className="mt-2 truncate text-[20px] font-bold leading-[1.2] tracking-normal text-[var(--cc-txt)]" style={{ fontFamily: 'var(--cc-disp), sans-serif' }}>
              {vm.name}
            </h3>
          </div>
        </div>
        <StatusBadge vm={vm} />
      </header>

      <p className="mt-3 line-clamp-2 max-w-[600px] text-[16px] leading-[1.7] text-[var(--cc-txt-2)]">{vm.tagline}</p>

      {showBullets && (
        <div className="mt-5">
          <Checkmarks bullets={vm.bullets} />
        </div>
      )}

      <footer className="mt-auto flex items-end justify-between gap-3 border-t border-[var(--cc-line-soft)] pt-6">
        {!isLocked ? (
          <span className="min-w-0 flex-1">
            <OwnerCaption vm={vm} />
          </span>
        ) : (
          <span className="flex-1" />
        )}

        <div className="flex shrink-0 items-center gap-2">
          {vm.canSelectLive && (
            <LiveEngineSelectButton engineId={vm.id} engineName={vm.name} isCurrentlySelected={vm.isSelectedLive} />
          )}
          {isLocked ? (
            <Link
              href={'/app/subscription' as Route}
              className="rounded-xl border border-[var(--cc-purple)]/45 bg-[var(--cc-purple-g)] px-4 py-2.5 text-[13.5px] font-semibold text-[var(--cc-purple)] transition-colors hover:bg-[var(--cc-purple)]/20"
            >
              {t('unlock')}
            </Link>
          ) : (
            <Link
              href={href}
              className="rounded-xl border border-[var(--cc-green)]/40 px-4 py-2.5 text-[13.5px] font-semibold text-[var(--cc-green)] transition-colors hover:bg-[var(--cc-green-g)]"
            >
              {t('open')}
            </Link>
          )}
        </div>
      </footer>
    </article>
  );
}
