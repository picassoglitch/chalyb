import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getSessionUser } from '@/lib/auth/session';
import { listEngines } from '@/lib/data/engines';
import { CATS, type EngineCategory } from '@/lib/data/types';
import { getTokenBalance } from '@/lib/usage/tokens';
import {
  engineIsLiveForUser,
  isChalybclipTrialActive,
  isChalybclipGraceActive,
  TIER_CAPS,
  effectiveTier,
  isAdminRole,
} from '@/lib/billing/tiers';
import { EnginesExplorer } from '@/components/workspace/engines/engines-explorer';
import {
  filterKeysFor,
  type EngineLiveState,
  type EngineVM,
} from '@/components/workspace/engines/engine-config';

// Browser tab → "Mis engines · Chalyb" (template in [locale]/layout.tsx).
export const metadata = { title: 'Mis engines' };

// PARTNER ranks alongside PRO for tier-required gates (same level of access).
const TIER_LABEL_SHORT = { FREE: 'Free', PRO: 'Pro', PARTNER: 'Partner', VIP: 'VIP' } as const;
const TIER_ORDER = { FREE: 0, PRO: 1, PARTNER: 1, VIP: 2 } as const;
const CAT_LABEL = Object.fromEntries(CATS.map((c) => [c.id, c.label])) as Record<
  EngineCategory,
  string
>;

// Spotlight ordering inside each section: featured first, then live, sim,
// locked, coming-soon — so the most actionable cards lead.
const STATE_RANK: Record<EngineLiveState, number> = {
  live: 1,
  trial: 1,
  simulation: 2,
  locked: 3,
  coming_soon: 4,
};

export default async function MyEnginesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('engines');

  const [engines, session] = await Promise.all([listEngines(), getSessionUser()]);
  const role = session?.role ?? 'VIEWER';
  const storedTier = session?.tier ?? 'FREE';
  const tier = effectiveTier(role, storedTier);
  const isAdmin = isAdminRole(role);
  const selectedEngineId = session?.selectedEngineId ?? null;
  const caps = TIER_CAPS[tier];

  // ChalybClip trial (7-day) + post-trial grace (bonus tokens) — both let a FREE
  // user run ChalybClip live. Mirror of the home/detail surfaces.
  const nowMs = new Date().getTime();
  const trialActive = isChalybclipTrialActive(session?.chalybclipTrialStartedAt ?? null, nowMs);
  // Real token balance for the user — drives the post-trial grace check AND the
  // "Tokens IA" capability card (so it reflects allocation + any bonus, not a
  // hardcoded plan figure).
  const balance = session
    ? await getTokenBalance(session.user.id).catch(() => null)
    : null;
  const clipBonusTokens = balance && !balance.unlimited ? balance.bonus : 0;
  const graceActive =
    tier === 'FREE' &&
    isChalybclipGraceActive(session?.chalybclipTrialStartedAt ?? null, nowMs, clipBonusTokens);

  // Marketing copy is localized in messages (engines.marketing*). Resolve it
  // here so the EngineVM carries plain strings across the RSC boundary.
  const marketingFor = (slug: string, category: EngineCategory, description: string) => {
    if (t.has(`marketing.${slug}.tagline`)) {
      const bullets = t.has(`marketing.${slug}.bullets`)
        ? (t.raw(`marketing.${slug}.bullets`) as string[])
        : [];
      return { tagline: t(`marketing.${slug}.tagline`), bullets };
    }
    return {
      tagline: t.has(`marketingCat.${category}`)
        ? t(`marketingCat.${category}`)
        : description.slice(0, 80),
      bullets: [] as string[],
    };
  };

  // Build the serializable view-models the client explorer renders. Deprecated
  // engines are hidden from the hub (consistent with the home page).
  const vms: EngineVM[] = engines
    .filter((e) => e.status !== 'deprecated')
    .map((engine) => {
      const meetsTier = TIER_ORDER[tier] >= TIER_ORDER[engine.tierRequired];
      const isOwnedByMe =
        engine.ownerUserId !== null && engine.ownerUserId === session?.user.id;
      const isPlatformOwned = engine.ownerUserId === null;
      const isLive = engineIsLiveForUser({
        tier,
        engineId: engine.id,
        engineSlug: engine.slug,
        engineStatus: engine.status,
        meetsTier,
        selectedEngineId,
        isOwnedByUser: isOwnedByMe,
        trialActive,
        graceActive,
      });

      const state: EngineLiveState =
        engine.status === 'coming_soon'
          ? 'coming_soon'
          : isLive
            ? tier === 'FREE'
              ? 'trial'
              : 'live'
            : !meetsTier
              ? 'locked'
              : 'simulation';

      const { tagline, bullets } = marketingFor(engine.slug, engine.category, engine.description);

      return {
        id: engine.id,
        slug: engine.slug,
        name: engine.name,
        icon: engine.icon,
        type: engine.type,
        categoryLabel: CAT_LABEL[engine.category] ?? engine.category,
        state,
        filterKeys: filterKeysFor(state),
        tagline,
        bullets,
        requiresPlanLabel:
          engine.tierRequired !== 'FREE' ? TIER_LABEL_SHORT[engine.tierRequired] : null,
        meetsTier,
        isPlatformOwned,
        isOwnedByMe,
        ownerLabel: isPlatformOwned
          ? 'Chalyb'
          : engine.ownerDisplayName || engine.ownerEmail?.split('@')[0] || 'Partner',
        featured: engine.slug === 'chalybclip' && engine.status === 'active',
        canSelectLive: tier === 'PRO' && engine.status === 'active' && meetsTier,
        isSelectedLive: engine.id === selectedEngineId,
      } satisfies EngineVM;
    })
    .sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return STATE_RANK[a.state] - STATE_RANK[b.state];
    });

  const liveCount = vms.filter((v) => v.state === 'live' || v.state === 'trial').length;
  // The engine to resume from the hero "Continuar" CTA — the first live/trial one.
  const continueVm = vms.find((v) => v.state === 'live' || v.state === 'trial');
  const continueEngine = continueVm ? { name: continueVm.name, slug: continueVm.slug } : null;
  // Pro upsell shows in the Pro section head when a FREE user has gated engines.
  const showUpsell = tier === 'FREE' && vms.some((v) => v.state === 'locked');

  const nf = (n: number) => n.toLocaleString(locale === 'es' ? 'es-MX' : 'en-US');

  return (
    <div className="cc-scroll">
      <div className="mx-auto max-w-6xl px-6 py-2 md:px-8">
        {vms.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-[var(--cc-line-2)] p-14 text-center">
            <div className="text-[14px] font-semibold text-[var(--cc-txt-2)]">{t('empty.title')}</div>
            <div className="mt-2 text-[12px] text-[var(--cc-txt-4)] [font-family:var(--cc-mono),monospace]">
              {t('empty.hint')}
            </div>
          </div>
        ) : (
          <EnginesExplorer
            engines={vms}
            liveCount={liveCount}
            continueEngine={continueEngine}
            tierLabel={caps.label}
            showUpsell={showUpsell}
          />
        )}

        {/* Plan capabilities — compact reference strip */}
        {vms.length > 0 && (
          <section className="mt-12 border-t border-[var(--cc-line)] pt-6">
            <div className="mb-5 text-[11px] font-semibold uppercase tracking-wider text-[var(--cc-txt-4)] [font-family:var(--cc-mono),monospace]">
              {isAdmin
                ? t('caps.heading', { plan: caps.label })
                : t('caps.headingPriced', { plan: caps.label, price: caps.price, per: caps.per })}
            </div>
            <div className="flex flex-wrap gap-x-10 gap-y-4">
              {[
                {
                  // Real count live right now (includes the ChalybClip trial/grace),
                  // not the static plan cap — matches the hero's "N en vivo ahora".
                  k: t('caps.liveEngines'),
                  v: caps.liveEnginesCount === Infinity ? '∞' : String(liveCount),
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
                  v: caps.historyDays >= 365 ? t('caps.historyYear') : t('caps.historyDays', { days: caps.historyDays }),
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
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
