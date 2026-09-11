import { setRequestLocale } from 'next-intl/server';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { listEngines } from '@/lib/data/engines';
import { getTokenBalance } from '@/lib/usage/tokens';
import {
  TIER_CAPS,
  effectiveTier,
  isAdminRole,
  engineIsLiveForUser,
  isChalybclipTrialActive,
  isChalybclipGraceActive,
  chalybclipTrialDaysLeft,
  CHALYBCLIP_TRIAL_SLUG,
} from '@/lib/billing/tiers';
import { WelcomeGiftBanner } from '@/components/workspace/welcome-gift-banner';
import { ChalybclipGraceBanner } from '@/components/workspace/chalybclip-grace-banner';
import { EngineGlyph } from '@/components/workspace/engines/engine-glyph';

export const metadata = { title: 'Tu espacio' };

const TIER_ORDER = { FREE: 0, PRO: 1, PARTNER: 1, VIP: 2 } as const;

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

  // Real token balance + engine catalog. Both tolerate failure (balance falls
  // back to a zeroed shape; engines to an empty list) so the home never 500s.
  const [balance, engines] = await Promise.all([
    session
      ? getTokenBalance(session.user.id).catch(() => null)
      : Promise.resolve(null),
    listEngines().catch(() => []),
  ]);

  // ChalybClip trial state (drives the live count + engine badges + spotlight).
  const nowMs = new Date().getTime();
  const trialActive = isChalybclipTrialActive(session?.chalybclipTrialStartedAt ?? null, nowMs);
  const trialDaysLeft = chalybclipTrialDaysLeft(session?.chalybclipTrialStartedAt ?? null, nowMs);
  // Post-trial grace: trial clock ran out but the FREE user still has PURCHASED
  // (bonus) tokens — ChalybClip stays live until those are spent, then ends for
  // good (bonus doesn't regenerate monthly). Only meaningful for FREE.
  const clipBonusTokens = balance && !balance.unlimited ? balance.bonus : 0;
  const graceActive =
    tier === 'FREE' &&
    isChalybclipGraceActive(session?.chalybclipTrialStartedAt ?? null, nowMs, clipBonusTokens);

  // Per-engine view models — single source for live status across the cards
  // and the "Engines en vivo" count.
  const engineViews = engines
    .filter((e) => e.status !== 'deprecated')
    .map((engine) => {
      const meetsTier = TIER_ORDER[tier] >= TIER_ORDER[engine.tierRequired];
      const isOwnedByMe =
        engine.ownerUserId !== null && engine.ownerUserId === session?.user.id;
      const isTrial = trialActive && engine.slug === CHALYBCLIP_TRIAL_SLUG;
      const isLive = engineIsLiveForUser({
        tier,
        engineId: engine.id,
        engineSlug: engine.slug,
        engineStatus: engine.status,
        meetsTier,
        selectedEngineId: session?.selectedEngineId ?? null,
        isOwnedByUser: isOwnedByMe,
        trialActive,
        graceActive,
      });
      const isSelected = engine.id === session?.selectedEngineId;
      return { engine, isLive, isTrial, isSelected };
    });

  // Live count for the stat card. Unlimited tiers (admin / VIP) show ∞.
  const liveCount = engineViews.filter((v) => v.isLive).length;
  const unlimitedLive = caps.liveEnginesCount === Infinity;
  const liveEngineNames = engineViews.filter((v) => v.isLive).map((v) => v.engine.name);
  const liveSub = trialActive
    ? `ChalybClip · prueba ${trialDaysLeft}d`
    : unlimitedLive
      ? 'todos disponibles'
      : liveEngineNames.length > 0
        ? `activo: ${liveEngineNames.join(', ')}`
        : tier === 'FREE'
          ? 'solo en modo prueba'
          : 'aún sin elegir';

  // Spotlight engine goes first: the live selection, else the active trial
  // engine, else the first active engine. Then live ones, then active, then
  // coming-soon — preserving the catalog's existing order within each bucket.
  const spotlightId =
    engineViews.find((v) => v.isSelected && v.isLive)?.engine.id ??
    engineViews.find((v) => v.isTrial)?.engine.id ??
    engineViews.find((v) => v.engine.status === 'active')?.engine.id ??
    null;
  const orderedViews = [...engineViews].sort((a, b) => {
    const rank = (v: (typeof engineViews)[number]) =>
      (v.engine.id === spotlightId ? 0 : 1) * 100 +
      (v.isLive ? 0 : 1) * 10 +
      (v.engine.status === 'active' ? 0 : 1);
    return rank(a) - rank(b);
  });

  const tokensBig = balance
    ? balance.unlimited
      ? '∞'
      : balance.remaining.toLocaleString('es-MX')
    : '0';
  const tokensSub = balance
    ? balance.unlimited
      ? 'admin · ilimitado'
      : `de ${(balance.monthlyAllocation + balance.bonus).toLocaleString('es-MX')} disponibles este mes`
    : `de ${caps.tokensPerMonth.toLocaleString('es-MX')} este mes`;

  const heroSub = isAdmin
    ? `Tu rol <b style="color:var(--cc-purple)">${role.replace('_', ' ')}</b> te da acceso completo a todos los engines, sin importar tu plan (almacenado: <b>${storedTier.replace('_', '-')}</b>).`
    : trialActive
      ? `Tu <b style="color:var(--cc-cyan)">prueba de ChalybClip Pro</b> está activa — te quedan ${trialDaysLeft} día${trialDaysLeft === 1 ? '' : 's'} corriendo en vivo. Mientras, prueba los demás en modo demo.`
      : tier === 'FREE'
        ? `Estás en el plan <b style="color:var(--cc-green)">Free</b>. Prueba los engines en modo demo y activa la ejecución en vivo cuando quieras.`
        : tier === 'PRO'
          ? `Estás en <b style="color:var(--cc-green)">Pro</b>${
              liveEngineNames.length > 0
                ? ` — tu lugar en vivo lo tiene <b>${liveEngineNames[0]}</b>.`
                : ' — aún no eliges tu engine en vivo. Entra a Mis engines para activar uno.'
            }`
          : `Estás en <b style="color:var(--cc-green)">VIP</b>. Todos los engines disponibles corren en vivo, con los límites más altos.`;

  return (
    <div className="cc-scroll">
      {/* First-time welcome gift — banner + confetti on accept. Renders nothing
          once the user has claimed (server passes the claimed flag). */}
      <WelcomeGiftBanner claimed={session?.welcomeGiftClaimedAt != null} />

      {/* Post-trial grace: ChalybClip trial expired but tokens remain — keep them
          going (and nudge toward Pro). Server-gated on graceActive. */}
      {graceActive && <ChalybclipGraceBanner tokensRemaining={clipBonusTokens} />}

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
        <p
          style={{ color: 'var(--cc-txt-3)', fontSize: 14, maxWidth: '64ch' }}
          dangerouslySetInnerHTML={{ __html: heroSub }}
        />
      </div>

      <div className="cc-mod-statgrid">
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Engines en vivo</div>
          <div className="cc-mod-stat-v gr">{unlimitedLive ? '∞' : liveCount}</div>
          <div className="cc-mod-stat-sub">{liveSub}</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Tokens IA</div>
          <div className="cc-mod-stat-v cy">{tokensBig}</div>
          <div className="cc-mod-stat-sub">{tokensSub}</div>
        </div>
      </div>

      <div className="cc-mod-section">
        <div className="cc-mod-sl">Tus engines</div>
        <div className="cc-mod-grid cc-mod-grid-2">
          {orderedViews.map(({ engine, isLive, isTrial }) => {
            const isComingSoon = engine.status === 'coming_soon';
            return (
              <Link
                key={engine.id}
                href={`/app/engines/${engine.slug}` as Route}
                className="cc-mod-card"
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'flex',
                  flexDirection: 'column',
                  borderColor: isLive ? 'var(--cc-green)' : undefined,
                  background: isLive ? 'rgba(158,234,58,.04)' : undefined,
                  opacity: isComingSoon ? 0.78 : 1,
                }}
              >
                <div className="cc-mod-card-head">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span
                      className={`relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border ${
                        isComingSoon
                          ? 'border-[var(--cc-line-2)] bg-[var(--cc-bg-2)] text-[var(--cc-txt-4)]'
                          : 'border-[var(--cc-green)]/30 bg-[var(--cc-green-g)] text-[var(--cc-green)]'
                      }`}
                    >
                      <EngineGlyph slug={engine.slug} size={22} />
                    </span>
                    <div>
                      <h4 style={{ fontSize: 14 }}>{engine.name}</h4>
                      <div
                        style={{
                          fontFamily: 'var(--cc-mono), monospace',
                          fontSize: 10.5,
                          color: 'var(--cc-txt-4)',
                          marginTop: 2,
                        }}
                      >
                        {engine.type}
                      </div>
                    </div>
                  </div>
                  {isComingSoon ? (
                    <span
                      className="cc-mod-badge"
                      style={{
                        color: 'var(--cc-purple)',
                        borderColor: 'rgba(157,123,255,.3)',
                        background: 'var(--cc-purple-g)',
                      }}
                    >
                      Próximamente
                    </span>
                  ) : isLive ? (
                    <span className="cc-mod-badge gr">
                      {isTrial ? `● Prueba ${trialDaysLeft}d` : '● EN VIVO'}
                    </span>
                  ) : (
                    <span className="cc-mod-badge cy">Disponible</span>
                  )}
                </div>
                <p>{engine.description}</p>
                <div className="cc-mod-meta" style={{ marginTop: 'auto' }}>
                  <span>{isComingSoon ? '→ Ver detalles' : '→ Abrir engine'}</span>
                </div>
              </Link>
            );
          })}

          {/* Upsell card — only for Free users (keeps the path to live execution
              one click away now that "Próximos pasos" is engine-first). */}
          {tier === 'FREE' && (
            <Link
              href={'/app/subscription' as Route}
              className="cc-mod-card"
              style={{
                textDecoration: 'none',
                color: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                borderStyle: 'dashed',
              }}
            >
              <div className="cc-mod-card-head">
                <span className="cc-mod-tag">Upgrade</span>
                <span className="cc-mod-badge cy">Cuando estés listo</span>
              </div>
              <h4>Pon tus engines en vivo</h4>
              <p>
                Pro ({TIER_CAPS.PRO.price}/{TIER_CAPS.PRO.per}) para un engine en vivo, o VIP (
                {TIER_CAPS.VIP.price}/{TIER_CAPS.VIP.per}) para todos.
              </p>
              <div className="cc-mod-meta" style={{ marginTop: 'auto' }}>
                <span>→ Ver planes</span>
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
