import { setRequestLocale } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import Image from 'next/image';
import type { Route } from 'next';
import type { Metadata } from 'next';
import { Link } from '@/i18n/routing';
import { getSessionUser, type SubscriptionTier } from '@/lib/auth/session';
import { listEngines } from '@/lib/data/engines';
import { getTokenBalance } from '@/lib/usage/tokens';
import {
  engineIsLiveForUser,
  isChalybclipTrialActive,
  isChalybclipGraceActive,
  CHALYBCLIP_TRIAL_SLUG,
  effectiveTier,
  isAdminRole,
} from '@/lib/billing/tiers';
import {
  ensureAdminEngineAccess,
  getEngineAccess,
} from '@/lib/engines/subscriptions';
import { EngineLaunchButton } from '@/components/workspace/engine-launch-button';
import { EngineReprovisionButton } from '@/components/workspace/engine-reprovision-button';

// Dynamic title: tab reads "ChalybClip · Chalyb", "ChalybStreamManager · Chalyb", etc.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const engines = await listEngines();
  const engine = engines.find((e) => e.slug === slug);
  return { title: engine?.name ?? 'Engine' };
}

// Per-engine workspace. Renders different content based on the engine + tier:
//   - Active + meets tier + Free       → simulation panel (mock controls)
//   - Active + meets tier + PRO/Above  → launch panel (real controls — placeholder for now)
//   - Active + above tier              → upgrade gate
//   - Coming-soon                      → notify-me panel
//   - Deprecated                       → 404 (deprecated engines are hidden from catalog)
//
// Real engine UIs (ChalybClip's clip editor, StreamManager's dashboard) plug in
// here when those products ship. For v1 we render the metadata + the right
// CTA for the user's state, with a "Build phase" placeholder for the actual
// interface.

// PARTNER ranks alongside PRO for tier-required gates: they get PRO-equivalent
// access. The owned-engine override (always live) is handled separately in
// engineCanRunLive via the `isOwnedByUser` flag — engine.tier_required still
// applies to the engines a partner DOESN'T own.
const TIER_LABEL_SHORT = {
  FREE: 'Free',
  PRO: 'Pro',
  PARTNER: 'Partner',
  VIP: 'VIP',
} as const;
const TIER_ORDER = { FREE: 0, PRO: 1, PARTNER: 1, VIP: 2 } as const;

export default async function EngineWorkspacePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const session = await getSessionUser();
  if (!session) redirect(`/sign-in?next=/app/engines/${slug}`);

  const engines = await listEngines();
  const engine = engines.find((e) => e.slug === slug);
  if (!engine || engine.status === 'deprecated') notFound();

  // ChalybClip has a real brand lockup — show it as a hero banner and drop the
  // generic emoji icon box from the header (the lockup already brands the page).
  const isChalybclip = engine.slug === CHALYBCLIP_TRIAL_SLUG;

  const role = session.role;
  const storedTier = session.tier;
  const tier = effectiveTier(role, storedTier);
  const isAdmin = isAdminRole(role);
  const meetsTier = TIER_ORDER[tier] >= TIER_ORDER[engine.tierRequired];
  // Partner-owned override: the engine's owner sees their own engine as
  // always-live (additive to any selected_engine_id they may also have).
  const isOwnedByMe =
    engine.ownerUserId !== null && engine.ownerUserId === session.user.id;
  // ChalybClip 7-day trial grants live access regardless of tier — it bypasses
  // both the tier-required gate and the selection gate (ChalybClip only). After
  // the trial, FREE users keep ChalybClip live in "grace" while tokens remain.
  const nowMs = new Date().getTime();
  const trialActive = isChalybclipTrialActive(session.chalybclipTrialStartedAt, nowMs);
  const clipBonusTokens =
    tier === 'FREE' && engine.slug === CHALYBCLIP_TRIAL_SLUG
      ? await getTokenBalance(session.user.id)
          .then((b) => (b.unlimited ? 0 : b.bonus))
          .catch(() => 0)
      : 0;
  const graceActive =
    tier === 'FREE' &&
    isChalybclipGraceActive(session.chalybclipTrialStartedAt, nowMs, clipBonusTokens);
  // ChalybClip is "unlocked" (live, bypassing tier/selection) under either the
  // trial or the post-trial grace window.
  const clipUnlocked = (trialActive || graceActive) && engine.slug === CHALYBCLIP_TRIAL_SLUG;
  const isLive = engineIsLiveForUser({
    tier,
    engineId: engine.id,
    engineSlug: engine.slug,
    engineStatus: engine.status,
    meetsTier,
    selectedEngineId: session.selectedEngineId,
    isOwnedByUser: isOwnedByMe,
    trialActive,
    graceActive,
  });
  const isComingSoon = engine.status === 'coming_soon';
  // Every engine gets a chip. Platform-owned (no partner_id) → "by Chalyb"
  // muted; partner-owned → "by [name]" purple.
  const isPlatformOwned = engine.ownerUserId === null;
  const ownerLabel = isPlatformOwned
    ? 'Chalyb'
    : engine.ownerDisplayName ||
      engine.ownerEmail?.split('@')[0] ||
      'Partner';

  // Lazy admin provisioning: admins have effective VIP via role
  // override, so they should auto-have engine access. If migration 0011's
  // backfill missed them (or a new engine was added after), create the row now.
  if (isAdmin && engine.status === 'active') {
    await ensureAdminEngineAccess(session.user.id, engine.id);
  }

  // Read the user's access record. Will be NULL for Free users (no access)
  // and for PRO users who haven't picked this engine as their live selection.
  const access = await getEngineAccess(session.user.id, engine.id);

  return (
    <div className="cc-scroll">
      {/* Back link */}
      <div style={{ marginBottom: 18 }}>
        <Link
          href={'/app/engines' as Route}
          style={{
            color: 'var(--cc-txt-4)',
            fontSize: 12,
            fontFamily: 'var(--cc-mono), monospace',
            textDecoration: 'none',
          }}
        >
          ← Volver a mis engines
        </Link>
      </div>

      {/* ChalybClip brand hero — full lockup. The logo's own dark background
          (#03040b) matches the banner fill, so the square reads as a floating
          mark rather than a pasted tile. */}
      {isChalybclip && (
        <div
          style={{
            marginBottom: 24,
            display: 'flex',
            justifyContent: 'center',
            padding: '22px 20px',
            border: '1px solid var(--cc-line-2)',
            borderRadius: 'var(--cc-r-l)',
            background: '#03040b',
          }}
        >
          <Image
            src="/chalybclip-logo.png"
            alt="ChalybClip — clips virales para streamers"
            width={240}
            height={240}
            priority
            style={{ display: 'block', width: 240, height: 240 }}
          />
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          gap: 18,
          alignItems: 'center',
          marginBottom: 24,
          flexWrap: 'wrap',
        }}
      >
        {!isChalybclip && (
          <div
            style={{
              fontSize: 44,
              width: 64,
              height: 64,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--cc-line-2)',
              borderRadius: 14,
              background: 'var(--cc-panel)',
            }}
          >
            {engine.icon}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2
            style={{
              fontFamily: 'var(--cc-disp), sans-serif',
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              marginBottom: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            {engine.name}
            <span
              style={{
                fontFamily: 'var(--cc-mono), monospace',
                fontSize: 11,
                letterSpacing: '0.1em',
                color: isPlatformOwned ? 'var(--cc-txt-4)' : 'var(--cc-purple)',
                background: isPlatformOwned
                  ? 'rgba(255,255,255,.03)'
                  : 'var(--cc-purple-g)',
                border: isPlatformOwned
                  ? '1px solid var(--cc-line-2)'
                  : '1px solid rgba(157,123,255,.3)',
                padding: '4px 10px',
                borderRadius: 5,
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
              title={`Engine creado por ${ownerLabel}${isOwnedByMe ? ' (tú)' : ''}`}
            >
              {isOwnedByMe ? 'Tu engine' : `by ${ownerLabel}`}
            </span>
          </h2>
          <div
            style={{
              color: 'var(--cc-txt-3)',
              fontSize: 13,
              fontFamily: 'var(--cc-mono), monospace',
            }}
          >
            {engine.type}
          </div>
        </div>
        <div>
          {isComingSoon ? (
            <span
              className="cc-mod-badge"
              style={{
                color: 'var(--cc-amber)',
                borderColor: 'rgba(245,177,61,.3)',
                background: 'var(--cc-amber-g)',
                padding: '6px 12px',
                fontSize: 11,
              }}
            >
              Próximamente
            </span>
          ) : isLive ? (
            <span className="cc-mod-badge gr" style={{ padding: '6px 12px', fontSize: 11 }}>
              ● En vivo
            </span>
          ) : meetsTier ? (
            <span className="cc-mod-badge cy" style={{ padding: '6px 12px', fontSize: 11 }}>
              Disponible
            </span>
          ) : (
            <span className="cc-mod-badge" style={{ padding: '6px 12px', fontSize: 11 }}>
              Requiere {TIER_LABEL_SHORT[engine.tierRequired]}
            </span>
          )}
        </div>
      </div>

      <p
        style={{
          color: 'var(--cc-txt-2)',
          fontSize: 14.5,
          lineHeight: 1.55,
          maxWidth: '64ch',
          marginBottom: 28,
        }}
      >
        {engine.description}
      </p>

      {/* Tier-state CTA panel */}
      {isComingSoon ? (
        <ComingSoonPanel engineName={engine.name} />
      ) : !meetsTier && !clipUnlocked ? (
        <UpgradeGatePanel engineName={engine.name} tierRequired={engine.tierRequired} />
      ) : isLive ? (
        <LaunchPanel
          engineId={engine.id}
          engineName={engine.name}
          integrationMode={engine.integrationMode}
          mode="live"
        />
      ) : (
        <LaunchPanel
          engineId={engine.id}
          engineName={engine.name}
          integrationMode={engine.integrationMode}
          mode="simulation"
          tier={tier}
          isAdmin={isAdmin}
        />
      )}

      {/* "Tu acceso" — engine subscription record. Shows when the user has
          a row in engine_subscriptions (PRO live selection, VIP seed,
          admin grant, or paid MP upgrade). Coming-soon engines never have access. */}
      {access && !isComingSoon && (
        <AccessPanel
          engineId={engine.id}
          engineName={engine.name}
          status={access.status}
          source={access.source}
          externalUserId={access.external_user_id}
          createdAt={access.created_at}
          requiresProvisioning={engine.requiresProvisioning}
        />
      )}

      {/* Engine metadata grid */}
      <div className="cc-mod-section">
        <div className="cc-mod-sl">Detalles del engine</div>
        <div className="cc-mod-statgrid">
          <div className="cc-mod-stat">
            <div className="cc-mod-stat-l">Status</div>
            <div
              className={`cc-mod-stat-v ${engine.status === 'active' ? 'gr' : engine.status === 'coming_soon' ? 'am' : ''}`}
            >
              {engine.status === 'active'
                ? 'Activo'
                : engine.status === 'coming_soon'
                  ? 'Próximamente'
                  : 'Deprecado'}
            </div>
            <div className="cc-mod-stat-sub">visible para tu plan</div>
          </div>
          <div className="cc-mod-stat">
            <div className="cc-mod-stat-l">Tier requerido</div>
            <div className="cc-mod-stat-v">{TIER_LABEL_SHORT[engine.tierRequired]}</div>
            <div className="cc-mod-stat-sub">para ejecución en vivo</div>
          </div>
          <div className="cc-mod-stat">
            <div className="cc-mod-stat-l">Categoría</div>
            <div className="cc-mod-stat-v">{engine.category}</div>
            <div className="cc-mod-stat-sub">{engine.type}</div>
          </div>
          <div className="cc-mod-stat">
            <div className="cc-mod-stat-l">Salud</div>
            <div className={`cc-mod-stat-v ${engine.state === 'HEALTHY' ? 'gr' : ''}`}>
              {engine.state === 'OFFLINE' ? '—' : `${engine.health}%`}
            </div>
            <div className="cc-mod-stat-sub">
              {engine.state === 'OFFLINE' ? 'sin ejecución activa' : engine.state.toLowerCase()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PANELS ────────────────────────────────────────────────────────────────

function LaunchPanel({
  engineId,
  engineName,
  integrationMode,
  mode,
  tier,
  isAdmin,
}: {
  engineId: string;
  engineName: string;
  integrationMode: 'internal_placeholder' | 'external_sso_redirect' | 'iframe_embed';
  mode: 'live' | 'simulation';
  tier?: SubscriptionTier;
  isAdmin?: boolean;
}) {
  const isLive = mode === 'live';
  // When the engine has a real external surface, the button does an SSO
  // redirect (signed token → engine validates → engine creates session). When
  // it doesn't (internal_placeholder), the button shows a toast explaining
  // that we're still pre-deploy.
  const hasExternalSurface = integrationMode !== 'internal_placeholder';

  return (
    <div
      style={{
        padding: '24px 26px',
        border: `1px solid ${isLive ? 'var(--cc-green)' : 'var(--cc-line-2)'}`,
        background: isLive ? 'var(--cc-green-g)' : 'var(--cc-panel)',
        borderRadius: 'var(--cc-r-l)',
        marginBottom: 28,
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontFamily: 'var(--cc-mono), monospace',
            fontSize: 10.5,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: isLive ? 'var(--cc-green)' : 'var(--cc-txt-4)',
            marginBottom: 6,
          }}
        >
          {isLive ? '● Modo en vivo' : 'Modo de prueba'}
        </div>
        <div style={{ fontSize: 15.5, color: 'var(--cc-txt)', fontWeight: 500 }}>
          {isLive
            ? `${engineName} está corriendo en vivo.`
            : `Prueba ${engineName} sin usar tus credenciales reales.`}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: 'var(--cc-txt-3)',
            marginTop: 4,
            lineHeight: 1.55,
            maxWidth: '60ch',
          }}
        >
          {isLive
            ? 'Cada trabajo descuenta de tu cuota mensual y los resultados se reflejan en tus integraciones externas.'
            : isAdmin
              ? 'Como admin estás viendo lo que vería un usuario Free. Para correrlo en vivo, usa el flujo normal de Pro o VIP.'
              : tier === 'FREE'
                ? 'En Free todos los engines corren con datos de prueba: sin riesgo y sin costo. Sube a Pro para ejecutarlo en vivo.'
                : 'Este engine no es el que tienes activo en vivo. Cámbialo desde /app/engines si quieres correrlo en vivo.'}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <EngineLaunchButton
          engineId={engineId}
          engineName={engineName}
          label={isLive ? `Abrir ${engineName} ↗` : `Abrir prueba de ${engineName} ↗`}
        />
        {!isLive && tier !== 'FREE' && (
          <Link
            href={'/app/engines' as Route}
            style={{
              padding: '11px 18px',
              borderRadius: 9,
              border: '1px solid var(--cc-line-2)',
              color: 'var(--cc-txt-2)',
              fontFamily: 'inherit',
              fontSize: 13.5,
              textDecoration: 'none',
              alignSelf: 'center',
            }}
          >
            Cambiar engine en vivo
          </Link>
        )}
      </div>

      <p
        style={{
          fontSize: 11.5,
          color: 'var(--cc-txt-4)',
          fontFamily: 'var(--cc-mono), monospace',
          marginTop: 14,
          paddingTop: 14,
          borderTop: '1px solid var(--cc-line-soft)',
        }}
      >
        {hasExternalSurface
          ? `▸ Abre ${engineName} en una pestaña nueva con sesión SSO firmada.`
          : `▸ La interfaz de ${engineName} se conecta aquí cuando el engine esté publicado.`}
      </p>
    </div>
  );
}

function UpgradeGatePanel({
  engineName,
  tierRequired,
}: {
  engineName: string;
  tierRequired: SubscriptionTier;
}) {
  return (
    <div
      style={{
        padding: '24px 26px',
        border: '1px solid var(--cc-amber)',
        background: 'var(--cc-amber-g)',
        borderRadius: 'var(--cc-r-l)',
        marginBottom: 28,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--cc-mono), monospace',
          fontSize: 10.5,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--cc-amber)',
          marginBottom: 6,
        }}
      >
        🔒 Necesitas un plan superior
      </div>
      <div style={{ fontSize: 15.5, color: 'var(--cc-txt)', fontWeight: 500, marginBottom: 4 }}>
        {engineName} requiere el plan {TIER_LABEL_SHORT[tierRequired]}.
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: 'var(--cc-txt-3)',
          marginBottom: 14,
          lineHeight: 1.55,
          maxWidth: '60ch',
        }}
      >
        Sube tu plan para desbloquear la ejecución en vivo. Tu plan actual sigue activo hasta el
        final del período.
      </div>
      <Link
        href={'/app/subscription' as Route}
        style={{
          display: 'inline-block',
          background: 'var(--cc-amber)',
          color: '#070809',
          padding: '11px 20px',
          borderRadius: 9,
          fontFamily: 'inherit',
          fontSize: 14,
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        Ver planes →
      </Link>
    </div>
  );
}

function AccessPanel({
  engineId,
  engineName,
  status,
  source,
  externalUserId,
  createdAt,
  requiresProvisioning,
}: {
  engineId: string;
  engineName: string;
  status: 'active' | 'paused' | 'cancelled';
  source: string;
  externalUserId: string | null;
  createdAt: string;
  requiresProvisioning: boolean;
}) {
  // Explain each `source` value in user-friendly language.
  const SOURCE_LABEL: Record<string, string> = {
    pro_selection: 'al elegir este engine como tu engine en vivo',
    all_access_seed: 'al activar tu plan VIP',
    admin_grant: 'concedido por admin',
    mp_payment: 'al confirmar tu pago en Mercado Pago',
    manual: 'manualmente',
  };
  const sourceText = SOURCE_LABEL[source] ?? source;
  const isInactive = status !== 'active';

  return (
    <div className="cc-mod-section" style={{ marginTop: 8 }}>
      <div className="cc-mod-sl">Tu acceso a {engineName}</div>
      <div
        style={{
          padding: '18px 22px',
          border: `1px solid ${isInactive ? 'var(--cc-line-2)' : 'var(--cc-green)'}`,
          background: isInactive ? 'var(--cc-panel)' : 'rgba(158,234,58,.04)',
          borderRadius: 'var(--cc-r-l)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 240 }}>
            <div
              style={{
                fontFamily: 'var(--cc-mono), monospace',
                fontSize: 10.5,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: isInactive ? 'var(--cc-txt-4)' : 'var(--cc-green)',
                marginBottom: 6,
              }}
            >
              ●{' '}
              {status === 'active'
                ? 'Cuenta lista'
                : status === 'paused'
                  ? 'Cuenta pausada'
                  : 'Cuenta cancelada'}
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--cc-txt-2)', lineHeight: 1.5 }}>
              Tu cuenta de {engineName} se creó {sourceText} el{' '}
              {new Date(createdAt).toLocaleDateString('es-MX', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
              .
            </div>
            {externalUserId ? (
              <div
                style={{
                  marginTop: 8,
                  fontFamily: 'var(--cc-mono), monospace',
                  fontSize: 11.5,
                  color: 'var(--cc-txt-4)',
                }}
              >
                ID en {engineName}: <b style={{ color: 'var(--cc-txt-3)' }}>{externalUserId}</b>
              </div>
            ) : requiresProvisioning ? (
              // Row exists but external provisioning didn't complete (or never ran —
              // common for admins backfilled by migration 0011 before secrets existed).
              // Show a manual retry; the toast surfaces the real reason on failure.
              <div
                style={{
                  marginTop: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--cc-mono), monospace',
                    fontSize: 11.5,
                    color: 'var(--cc-amber)',
                  }}
                >
                  ⚠ La configuración quedó incompleta — todavía no tienes ID en {engineName}.
                </div>
                <EngineReprovisionButton engineId={engineId} engineName={engineName} />
                <div
                  style={{
                    fontFamily: 'var(--cc-mono), monospace',
                    fontSize: 10.5,
                    color: 'var(--cc-txt-4)',
                    lineHeight: 1.5,
                    maxWidth: '60ch',
                  }}
                >
                  Si esto falla: (1) verifica que {engineName} esté corriendo en su URL;
                  (2) que <code>{`${engineName.toUpperCase().replace(/[^A-Z0-9]/g, '')}_ADMIN_TOKEN`}</code>{' '}
                  en Vercel coincida con <code>CHALYB_ADMIN_TOKEN</code> en {engineName};{' '}
                  (3) que la URL en <code>engines.admin_api_base</code> apunte al endpoint
                  correcto. El log del dev server (busca <code>[engine_subs]</code>) muestra
                  el error exacto.
                </div>
              </div>
            ) : (
              <div
                style={{
                  marginTop: 8,
                  fontFamily: 'var(--cc-mono), monospace',
                  fontSize: 11.5,
                  color: 'var(--cc-txt-4)',
                }}
              >
                ▸ ID pendiente — se asigna cuando {engineName} abra su API de configuración.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ComingSoonPanel({ engineName }: { engineName: string }) {
  return (
    <div
      style={{
        padding: '24px 26px',
        border: '1px dashed var(--cc-line-2)',
        background: 'var(--cc-panel)',
        borderRadius: 'var(--cc-r-l)',
        marginBottom: 28,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--cc-mono), monospace',
          fontSize: 10.5,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--cc-amber)',
          marginBottom: 6,
        }}
      >
        📅 Próximamente
      </div>
      <div style={{ fontSize: 15.5, color: 'var(--cc-txt)', fontWeight: 500, marginBottom: 4 }}>
        {engineName} está en construcción.
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: 'var(--cc-txt-3)',
          marginBottom: 14,
          lineHeight: 1.55,
          maxWidth: '60ch',
        }}
      >
        Te notificaremos por correo cuando lo lancemos. Mientras tanto, explora los engines
        activos.
      </div>
      <Link
        href={'/app/engines' as Route}
        style={{
          display: 'inline-block',
          padding: '11px 20px',
          borderRadius: 9,
          border: '1px solid var(--cc-line-2)',
          color: 'var(--cc-txt)',
          fontFamily: 'inherit',
          fontSize: 14,
          textDecoration: 'none',
        }}
      >
        Ver engines disponibles →
      </Link>
    </div>
  );
}
