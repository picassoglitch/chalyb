import { setRequestLocale } from 'next-intl/server';
import { cookies } from 'next/headers';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { listEngines } from '@/lib/data/engines';
import { getTokenBalance } from '@/lib/usage/tokens';
import {
  TIER_CAPS,
  effectiveTier,
  isAdminRole,
  isChalybclipTrialActive,
  isChalybclipGraceActive,
  chalybclipTrialDaysLeft,
  CHALYBCLIP_TRIAL_SLUG,
} from '@/lib/billing/tiers';
import {
  deriveEngineViews,
  deriveNextAction,
  liveCapacityLabel,
  summarizeFleet,
  type EngineView,
} from '@/lib/billing/readiness';
import { entitlementSource, getEntitlementEvidence } from '@/lib/billing/entitlement';
import { KIT_TOOLS, kitToolBySlug } from '@/lib/kit/tools';
import { WelcomeGiftBanner } from '@/components/workspace/welcome-gift-banner';
import { WELCOME_DISMISSED_COOKIE, isWelcomeDismissedFor } from '@/lib/usage/welcome-dismissal';
import { ChalybclipGraceBanner } from '@/components/workspace/chalybclip-grace-banner';
import { EngineGlyph } from '@/components/workspace/engines/engine-glyph';
import { EngineStatusBadge } from '@/components/workspace/engines/engine-status-badge';

export const metadata = { title: 'Tu kit' };

// /app — mission control for the kit. Three questions, answered honestly from
// the same readiness model every other surface uses (lib/billing/readiness):
//   1. what is running right now (never a plan cap dressed up as a count),
//   2. the ONE next thing to do,
//   3. the whole kit on equal footing — Clip is one tool among eight.

export default async function WorkspaceHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSessionUser();
  const meta = session?.user.user_metadata ?? {};
  const name =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    session?.user.email?.split('@')[0] ||
    'Operator';
  const role = session?.role ?? 'VIEWER';
  const storedTier = session?.tier ?? 'FREE';
  const tier = effectiveTier(role, storedTier);
  const isAdmin = isAdminRole(role);
  const caps = TIER_CAPS[tier];

  const welcomeClaimed = session?.welcomeGiftClaimedAt != null;
  const welcomeDismissed = session
    ? isWelcomeDismissedFor((await cookies()).get(WELCOME_DISMISSED_COOKIE)?.value, session.user.id)
    : false;

  const [balance, engines, evidence] = await Promise.all([
    session ? getTokenBalance(session.user.id).catch(() => null) : Promise.resolve(null),
    listEngines().catch(() => []),
    session
      ? getEntitlementEvidence(session.user.id)
      : Promise.resolve({ approvedPayments: 0, hasBillingSubscription: false }),
  ]);
  const source = entitlementSource({ storedTier, role, evidence });

  const nowMs = new Date().getTime();
  const trialActive = isChalybclipTrialActive(session?.chalybclipTrialStartedAt ?? null, nowMs);
  const trialDaysLeft = chalybclipTrialDaysLeft(session?.chalybclipTrialStartedAt ?? null, nowMs);
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
  const clipView = views.find((v) => v.engine.slug === CHALYBCLIP_TRIAL_SLUG);
  const clipRunnable = clipView?.isRunnable ?? false;
  const liveNames = views.filter((v) => v.isLive).map((v) => v.engine.name);

  // Kit strip order: live first, then ready/simulation, then locked, then
  // upcoming — but every tool is on the same footing (same card, same size).
  const RANK: Record<EngineView['state'], number> = {
    live: 0,
    trial: 0,
    ready: 1,
    simulation: 2,
    locked: 3,
    coming_soon: 4,
  };
  const orderedViews = [...views].sort((a, b) => RANK[a.state] - RANK[b.state]);

  const tokensBig = balance
    ? balance.unlimited
      ? '∞'
      : balance.remaining.toLocaleString('es-MX')
    : '0';
  const tokensSub = balance
    ? balance.unlimited
      ? 'admin · sin límite'
      : `de ${(balance.monthlyAllocation + balance.bonus).toLocaleString('es-MX')} este mes`
    : `de ${caps.tokensPerMonth.toLocaleString('es-MX')} este mes`;

  const planLabel = caps.label;
  const planNote =
    source === 'comped'
      ? ' (asignado · cortesía, sin cobro)'
      : source === 'partner'
        ? ' (programa Partner)'
        : '';

  // ── Hero copy: plan + fleet, in one honest sentence ─────────────────────
  let heroSub: React.ReactNode;
  if (isAdmin) {
    heroSub = (
      <>
        Tu rol <b style={{ color: 'var(--cc-purple)' }}>{role.replace('_', ' ')}</b> te da acceso a
        todo el kit sin importar el plan guardado (<b>{storedTier}</b>). Hoy hay <b>{fleet.live}</b>{' '}
        en vivo y <b>{fleet.upcoming}</b> en construcción.
      </>
    );
  } else if (fleet.runnable === 0) {
    heroSub = (
      <>
        Estás en <b style={{ color: 'var(--cc-green)' }}>{planLabel}</b>
        {planNote}. El kit está en construcción: <b>{fleet.upcoming}</b> herramienta
        {fleet.upcoming === 1 ? '' : 's'} próximamente y ninguna lista todavía. En cuanto la primera
        se publique, aparece aquí como <b>Listo</b>{' '}
        {tier === 'FREE'
          ? 'para probarla en simulación.'
          : tier === 'VIP'
            ? 'y corre en vivo con tu plan.'
            : 'para encenderla en vivo con tu lugar Pro.'}
      </>
    );
  } else if (trialActive && clipRunnable && tier === 'FREE') {
    heroSub = (
      <>
        Tu <b style={{ color: 'var(--cc-cyan)' }}>prueba de ChalyClip Pro</b> está activa: te quedan{' '}
        {trialDaysLeft} día{trialDaysLeft === 1 ? '' : 's'} en vivo. El resto del kit lo exploras en
        simulación.
      </>
    );
  } else if (tier === 'FREE') {
    heroSub = (
      <>
        Estás en <b style={{ color: 'var(--cc-green)' }}>Free</b>: explora el kit en simulación. Pro
        enciende una herramienta en vivo; VIP, todo el kit.
      </>
    );
  } else if (tier === 'VIP') {
    heroSub = (
      <>
        Estás en <b style={{ color: 'var(--cc-green)' }}>VIP</b>
        {planNote}: todo el kit incluido. {fleet.live} de {fleet.runnable} herramienta
        {fleet.runnable === 1 ? '' : 's'} lista{fleet.runnable === 1 ? '' : 's'} corre
        {fleet.live === 1 ? '' : 'n'} en vivo; {fleet.upcoming} más vienen en camino.
      </>
    );
  } else {
    heroSub = (
      <>
        Estás en <b style={{ color: 'var(--cc-green)' }}>{planLabel}</b>
        {planNote}
        {liveNames.length > 0 ? (
          <>
            : tu lugar en vivo lo tiene <b>{liveNames[0]}</b>.
          </>
        ) : (
          <>: tu plan enciende una herramienta en vivo y aún no eliges cuál.</>
        )}
      </>
    );
  }

  // ── The one primary action ──────────────────────────────────────────────
  const primary = (() => {
    switch (next.kind) {
      case 'open_live':
        return {
          tag: 'Corriendo ahora',
          title: `Abrir ${next.engine.name}`,
          body: 'Está en vivo con tu plan. Entra y sigue trabajando.',
          cta: `Abrir ${next.engine.name} →`,
          href: `/app/engines/${next.engine.slug}` as Route,
        };
      case 'pick_live':
        return {
          tag: 'Tu lugar en vivo está libre',
          title: 'Elige tu herramienta en vivo',
          body: `Tu plan enciende una herramienta en vivo a tu elección. ${next.engine.name} ya está lista.`,
          cta: 'Activar en vivo →',
          href: `/app/engines/${next.engine.slug}` as Route,
        };
      case 'explore_sim':
        return {
          tag: 'Listo para probar',
          title: `Explora ${next.engine.name} en simulación`,
          body: 'Sin credenciales reales y sin costo. Cuando te convenza, Pro lo pone en vivo.',
          cta: 'Abrir en simulación →',
          href: `/app/engines/${next.engine.slug}` as Route,
        };
      default:
        return {
          tag: 'El kit está en construcción',
          title: 'Conoce lo que viene en tu kit',
          body: `${fleet.upcoming || KIT_TOOLS.length} herramientas en camino, todas incluidas en una sola suscripción. Sin nada que activar todavía.`,
          cta: 'Ver el kit →',
          href: '/app/engines' as Route,
        };
    }
  })();

  const planCard = (() => {
    if (isAdmin) return null;
    if (tier === 'FREE') {
      return {
        title: 'Un plan para todo el kit',
        body: `Free explora en simulación. Pro (${TIER_CAPS.PRO.price}/${TIER_CAPS.PRO.per}) enciende una herramienta en vivo a tu elección. VIP (${TIER_CAPS.VIP.price}/${TIER_CAPS.VIP.per}) abre el kit completo.`,
        cta: 'Ver planes →',
      };
    }
    if (tier === 'VIP') {
      return {
        title: 'Todo el kit, incluido',
        body: `Cada herramienta que se publique corre en vivo con tu plan${planNote}.`,
        cta: 'Gestionar plan →',
      };
    }
    return {
      title: 'Una herramienta en vivo, tú eliges',
      body: `Cámbiala cuando quieras desde Mis engines. VIP abre el kit completo${planNote ? `. Tu plan actual${planNote}` : ''}.`,
      cta: 'Gestionar plan →',
    };
  })();

  return (
    <div className="cc-scroll">
      {session && (
        <WelcomeGiftBanner
          claimed={welcomeClaimed}
          initiallyDismissed={welcomeDismissed}
          userId={session.user.id}
          clipRunnable={clipRunnable}
          monthlyTokens={TIER_CAPS.FREE.tokensPerMonth}
        />
      )}

      {graceActive && clipRunnable && <ChalybclipGraceBanner tokensRemaining={clipBonusTokens} />}

      <div className="cc-mod-section">
        <h2
          style={{
            fontFamily: 'var(--cc-disp), sans-serif',
            fontSize: 'clamp(22px, 3vw, 32px)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            marginBottom: 6,
          }}
        >
          Hola, {name.split(' ')[0]} 👋
        </h2>
        <p style={{ color: 'var(--cc-txt-3)', fontSize: 14, maxWidth: '66ch', lineHeight: 1.55 }}>
          {heroSub}
        </p>
      </div>

      <div className="cc-mod-statgrid">
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">En vivo</div>
          <div className={`cc-mod-stat-v ${fleet.live > 0 ? 'gr' : ''}`}>{fleet.live}</div>
          <div className="cc-mod-stat-sub">
            {fleet.live > 0 ? liveNames.join(', ') : liveCapacityLabel(tier, fleet)}
          </div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Listas</div>
          <div className={`cc-mod-stat-v ${fleet.runnable > 0 ? 'cy' : ''}`}>{fleet.runnable}</div>
          <div className="cc-mod-stat-sub">
            {fleet.runnable === 0 ? 'ninguna publicada aún' : 'herramientas que ya puedes abrir'}
          </div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Próximamente</div>
          <div className="cc-mod-stat-v am">{fleet.upcoming}</div>
          <div className="cc-mod-stat-sub">en construcción · incluidas en tu plan</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Tokens IA</div>
          <div className="cc-mod-stat-v cy">{tokensBig}</div>
          <div className="cc-mod-stat-sub">{tokensSub}</div>
        </div>
      </div>

      <div className="cc-mod-section">
        <div className="cc-mod-sl">Siguiente paso</div>
        <div className="cc-mod-grid cc-mod-grid-2">
          <Link
            href={primary.href}
            className="cc-mod-card"
            style={{
              textDecoration: 'none',
              color: 'inherit',
              borderColor: 'var(--cc-green)',
              background: 'rgba(158,234,58,.05)',
            }}
          >
            <div className="cc-mod-card-head">
              <span className="cc-mod-tag" style={{ color: 'var(--cc-green)' }}>
                {primary.tag}
              </span>
            </div>
            <h4 style={{ fontSize: 17 }}>{primary.title}</h4>
            <p>{primary.body}</p>
            <div className="cc-mod-meta" style={{ marginTop: 'auto' }}>
              <b className="gr">{primary.cta}</b>
            </div>
          </Link>

          {planCard && (
            <Link
              href={'/app/subscription' as Route}
              className="cc-mod-card"
              style={{ textDecoration: 'none', color: 'inherit', borderStyle: 'dashed' }}
            >
              <div className="cc-mod-card-head">
                <span className="cc-mod-tag">Tu plan · {planLabel}</span>
                {source === 'comped' && <span className="cc-mod-badge am">cortesía</span>}
                {source === 'partner' && <span className="cc-mod-badge pu">programa</span>}
              </div>
              <h4>{planCard.title}</h4>
              <p>{planCard.body}</p>
              <div className="cc-mod-meta" style={{ marginTop: 'auto' }}>
                <span>{planCard.cta}</span>
              </div>
            </Link>
          )}
        </div>
      </div>

      <div className="cc-mod-section">
        <div className="cc-mod-sl">
          Tu kit · {views.length || KIT_TOOLS.length} herramientas, una suscripción
        </div>
        <div className="cc-mod-grid">
          {orderedViews.length > 0
            ? orderedViews.map((v) => (
                <KitCard
                  key={v.engine.id}
                  slug={v.engine.slug}
                  name={v.engine.name}
                  purpose={
                    engines.find((e) => e.id === v.engine.id)?.description ||
                    kitToolBySlug(v.engine.slug)?.purpose ||
                    ''
                  }
                  state={v.state}
                  trialDaysLeft={trialDaysLeft}
                  lockedPlan={v.engine.tierRequired === 'VIP' ? 'VIP' : 'Pro'}
                  href={`/app/engines/${v.engine.slug}` as Route}
                />
              ))
            : // Catalog unreachable or empty: the kit still gets taught, honestly
              // marked as upcoming, with a path into the engines page.
              KIT_TOOLS.map((tool) => (
                <KitCard
                  key={tool.slug}
                  slug={tool.slug}
                  name={tool.name}
                  purpose={tool.purpose}
                  state="coming_soon"
                  href={'/app/engines' as Route}
                />
              ))}
        </div>
      </div>
    </div>
  );
}

function KitCard({
  slug,
  name,
  purpose,
  state,
  trialDaysLeft,
  lockedPlan,
  href,
}: {
  slug: string;
  name: string;
  purpose: string;
  state: EngineView['state'];
  trialDaysLeft?: number;
  lockedPlan?: string;
  href: Route;
}) {
  const isUpcoming = state === 'coming_soon';
  const isOn = state === 'live' || state === 'trial';
  return (
    <Link
      href={href}
      className="cc-mod-card"
      style={{
        textDecoration: 'none',
        color: 'inherit',
        borderColor: isOn ? 'var(--cc-green)' : undefined,
        background: isOn ? 'rgba(158,234,58,.04)' : undefined,
        opacity: isUpcoming ? 0.82 : 1,
      }}
    >
      <div className="cc-mod-card-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span
            className={`relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border ${
              isUpcoming
                ? 'border-[var(--cc-line-2)] bg-[var(--cc-bg-2)] text-[var(--cc-txt-3)]'
                : 'border-[var(--cc-green)]/30 bg-[var(--cc-green-g)] text-[var(--cc-green)]'
            }`}
          >
            <EngineGlyph slug={slug} size={20} />
          </span>
          <h4 style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</h4>
        </div>
        <EngineStatusBadge state={state} trialDaysLeft={trialDaysLeft} lockedPlan={lockedPlan} />
      </div>
      <p style={{ minHeight: 38 }}>{purpose}</p>
      <div className="cc-mod-meta" style={{ marginTop: 'auto' }}>
        <span>
          {isUpcoming
            ? '→ Ver detalles'
            : state === 'ready'
              ? '→ Activar en vivo'
              : state === 'locked'
                ? '→ Ver cómo desbloquear'
                : '→ Abrir'}
        </span>
      </div>
    </Link>
  );
}
