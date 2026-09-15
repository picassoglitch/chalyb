import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getSessionUser } from '@/lib/auth/session';
import { listEngines } from '@/lib/data/engines';
import { CATS, type EngineCategory } from '@/lib/data/types';
import { getTokenBalance } from '@/lib/usage/tokens';
import {
  isChalybclipTrialActive,
  isChalybclipGraceActive,
  chalybclipTrialDaysLeft,
  TIER_CAPS,
  effectiveTier,
  isAdminRole,
} from '@/lib/billing/tiers';
import {
  deriveEngineViews,
  deriveNextAction,
  liveCapacityLabel,
  summarizeFleet,
  type EngineDisplayState,
} from '@/lib/billing/readiness';
import { KIT_TOOLS } from '@/lib/kit/tools';
import { EnginesExplorer } from '@/components/workspace/engines/engines-explorer';
import {
  filterKeysFor,
  type EngineHeroAction,
  type EngineVM,
} from '@/components/workspace/engines/engine-config';
import { EngineGlyph } from '@/components/workspace/engines/engine-glyph';

// Browser tab → "Mis engines · Chalyb" (template in [locale]/layout.tsx).
export const metadata = { title: 'Mis engines' };

const TIER_LABEL_SHORT = { FREE: 'Free', PRO: 'Pro', PARTNER: 'Partner', VIP: 'VIP' } as const;
const CAT_LABEL = Object.fromEntries(CATS.map((c) => [c.id, c.label])) as Record<
  EngineCategory,
  string
>;

// Spotlight ordering inside each section: live, ready, sim, locked, upcoming —
// so the most actionable cards lead.
const STATE_RANK: Record<EngineDisplayState, number> = {
  live: 0,
  trial: 0,
  ready: 1,
  simulation: 2,
  locked: 3,
  coming_soon: 4,
};

export default async function MyEnginesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('engines');

  const [engines, session] = await Promise.all([listEngines().catch(() => []), getSessionUser()]);
  const role = session?.role ?? 'VIEWER';
  const storedTier = session?.tier ?? 'FREE';
  const tier = effectiveTier(role, storedTier);
  const isAdmin = isAdminRole(role);
  const caps = TIER_CAPS[tier];

  const nowMs = new Date().getTime();
  const trialActive = isChalybclipTrialActive(session?.chalybclipTrialStartedAt ?? null, nowMs);
  const trialDaysLeft = chalybclipTrialDaysLeft(session?.chalybclipTrialStartedAt ?? null, nowMs);
  const balance = session ? await getTokenBalance(session.user.id).catch(() => null) : null;
  const clipBonusTokens = balance && !balance.unlimited ? balance.bonus : 0;
  const graceActive =
    tier === 'FREE' &&
    isChalybclipGraceActive(session?.chalybclipTrialStartedAt ?? null, nowMs, clipBonusTokens);

  const views = deriveEngineViews(engines, {
    tier,
    userId: session?.user.id ?? null,
    selectedEngineId: session?.selectedEngineId ?? null,
    trialActive,
    graceActive,
  });
  const fleet = summarizeFleet(views);
  const next = deriveNextAction(views);

  const marketingFor = (slug: string, category: EngineCategory, description: string) => {
    if (t.has(`marketing.${slug}.tagline`)) {
      const bullets = t.has(`marketing.${slug}.bullets`)
        ? (t.raw(`marketing.${slug}.bullets`) as string[])
        : [];
      return { tagline: t(`marketing.${slug}.tagline`), bullets };
    }
    return {
      tagline:
        description || (t.has(`marketingCat.${category}`) ? t(`marketingCat.${category}`) : ''),
      bullets: [] as string[],
    };
  };

  const vms: EngineVM[] = views
    .map((v) => {
      const { engine } = v;
      const full = engines.find((e) => e.id === engine.id);
      const isPlatformOwned = engine.ownerUserId === null;
      const { tagline, bullets } = marketingFor(
        engine.slug,
        full?.category ?? 'INTERNAL',
        full?.description ?? '',
      );
      return {
        id: engine.id,
        slug: engine.slug,
        name: engine.name,
        icon: full?.icon ?? '◆',
        type: full?.type ?? '',
        categoryLabel: full ? (CAT_LABEL[full.category] ?? full.category) : '',
        state: v.state,
        filterKeys: filterKeysFor(v.state),
        tagline,
        bullets,
        requiresPlanLabel:
          engine.tierRequired !== 'FREE' ? TIER_LABEL_SHORT[engine.tierRequired] : null,
        meetsTier: v.meetsTier,
        isPlatformOwned,
        isOwnedByMe: v.isOwnedByMe,
        ownerLabel: isPlatformOwned
          ? 'Chalyb'
          : full?.ownerDisplayName || full?.ownerEmail?.split('@')[0] || 'Partner',
        // The spotlight is whatever is running live, not a fixed product.
        featured: v.isLive,
        canSelectLive: v.canSelectLive,
        isSelectedLive: v.isSelected,
        trialDaysLeft: v.isTrial ? trialDaysLeft : 0,
      } satisfies EngineVM;
    })
    .sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state]);

  const showUpsell = tier === 'FREE' && vms.some((v) => v.state === 'locked');

  // The hero's one action, from the same readiness model as the cards.
  const heroAction: EngineHeroAction = (() => {
    const badge =
      fleet.live > 0
        ? t('hero.badgeLive', { count: fleet.live })
        : fleet.runnable > 0
          ? t('hero.badgeReady', { count: fleet.runnable })
          : t('hero.badgeUpcoming', { count: fleet.upcoming });
    const plansLink =
      tier === 'FREE'
        ? { secondaryLabel: t('hero.ctaPlans'), secondaryHref: '/app/subscription' }
        : { secondaryLabel: null, secondaryHref: null };
    switch (next.kind) {
      case 'open_live':
        return {
          badge,
          heading: t('hero.headingContinue'),
          sub: t('hero.subContinue', { name: next.engine.name }),
          ctaLabel: t('hero.ctaContinue'),
          href: `/app/engines/${next.engine.slug}`,
          ...plansLink,
        };
      case 'pick_live':
        return {
          badge,
          heading: t('hero.headingPick'),
          sub: t('hero.subPick', { name: next.engine.name }),
          ctaLabel: t('hero.ctaPick', { name: next.engine.name }),
          href: `/app/engines/${next.engine.slug}`,
          ...plansLink,
        };
      case 'explore_sim':
        return {
          badge,
          heading: t('hero.headingExplore'),
          sub: t('hero.subExplore', { name: next.engine.name }),
          ctaLabel: t('hero.ctaExplore', { name: next.engine.name }),
          href: `/app/engines/${next.engine.slug}`,
          ...plansLink,
        };
      default:
        return {
          badge,
          heading: t('hero.headingUpcoming'),
          sub: t('hero.subUpcoming', { count: fleet.upcoming }),
          ctaLabel: t('hero.ctaUpcoming'),
          href: '/app/subscription',
          secondaryLabel: t('hero.ctaHome'),
          secondaryHref: '/app',
        };
    }
  })();

  const nf = (n: number) => n.toLocaleString(locale === 'es' ? 'es-MX' : 'en-US');

  return (
    <div className="cc-scroll">
      <div className="mx-auto max-w-6xl px-6 py-2 md:px-8">
        {vms.length === 0 ? (
          // Catalog empty or unreachable. The kit still gets shown — as the
          // static list, all upcoming — with the plan story and a way forward.
          <section className="flex flex-col gap-6">
            <EnginesExplorerEmptyKit
              title={t('empty.title')}
              body={t('empty.body')}
              hint={isAdmin ? t('empty.hint') : null}
            />
          </section>
        ) : (
          <EnginesExplorer
            engines={vms}
            heroAction={heroAction}
            tierLabel={caps.label}
            showUpsell={showUpsell}
            isFree={tier === 'FREE'}
          />
        )}

        <section className="mt-12 border-t border-[var(--cc-line)] pt-6">
          <div className="mb-5 text-[11px] font-semibold uppercase tracking-wider text-[var(--cc-txt-4)] [font-family:var(--cc-mono),monospace]">
            {isAdmin
              ? t('caps.heading', { plan: caps.label })
              : t('caps.headingPriced', { plan: caps.label, price: caps.price, per: caps.per })}
          </div>
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            {[
              {
                k: t('caps.liveEngines'),
                v: String(fleet.live),
                sub: liveCapacityLabel(tier, fleet),
              },
              {
                k: t('caps.tokens'),
                v: balance
                  ? balance.unlimited
                    ? '∞'
                    : nf(balance.monthlyAllocation + balance.bonus)
                  : nf(caps.tokensPerMonth),
              },
              {
                k: t('caps.storage'),
                v: caps.storageMB >= 1000 ? `${caps.storageMB / 1000} GB` : `${caps.storageMB} MB`,
              },
              {
                k: t('caps.history'),
                v:
                  caps.historyDays >= 365
                    ? t('caps.historyYear')
                    : t('caps.historyDays', { days: caps.historyDays }),
              },
              {
                k: t('caps.support'),
                v: caps.hasPrioritySupport
                  ? t('caps.supportPriority')
                  : tier === 'PRO'
                    ? t('caps.supportEmail')
                    : t('caps.supportCommunity'),
              },
            ].map((row) => (
              <div key={row.k} className="space-y-1">
                <div className="text-2xl font-semibold text-[var(--cc-txt)]">{row.v}</div>
                <div className="text-xs text-[var(--cc-txt-4)]">{row.k}</div>
                {'sub' in row && row.sub && (
                  <div className="text-[11px] text-[var(--cc-txt-3)]">{row.sub}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// Empty-catalog fallback: teach the bundle with the static kit list. Server
// component, so it can render before the client island exists.
function EnginesExplorerEmptyKit({
  title,
  body,
  hint,
}: {
  title: string;
  body: string;
  hint: string | null;
}) {
  return (
    <>
      <div className="rounded-[14px] border border-dashed border-[var(--cc-line-2)] p-8 text-center">
        <div className="text-[15px] font-semibold text-[var(--cc-txt)]">{title}</div>
        <p className="mx-auto mt-2 max-w-[56ch] text-[13px] leading-relaxed text-[var(--cc-txt-3)]">
          {body}
        </p>
        {hint && (
          <div className="mt-3 text-[11.5px] text-[var(--cc-txt-4)] [font-family:var(--cc-mono),monospace]">
            {hint}
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {KIT_TOOLS.map((tool) => (
          <div
            key={tool.slug}
            className="flex items-center gap-4 rounded-2xl border border-[var(--cc-line)] bg-[var(--cc-panel)]/60 p-5 opacity-80"
          >
            <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-[var(--cc-line-2)] bg-[var(--cc-bg-2)] text-[var(--cc-txt-3)]">
              <EngineGlyph slug={tool.slug} size={24} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold text-[var(--cc-txt-2)]">
                {tool.name}
              </div>
              <div className="mt-1 text-[12px] text-[var(--cc-txt-3)]">{tool.purpose}</div>
            </div>
            <span className="cc-mod-badge">Próximamente</span>
          </div>
        ))}
      </div>
    </>
  );
}
