// /app/usage — token balance + activity feed + buy-token-pack tiles.
//
// Hardening pass: this page kept 500'ing on action-POST re-renders ("Server
// Components render" error in production). Root cause was multiple
// data-fetch surfaces that could throw OUTSIDE of try/catch:
//
//   1. getSessionUser() — calls createClient() which throws on missing
//      env vars, then queries profiles which can throw on RLS / dropped
//      connection.
//   2. setRequestLocale(locale) — throws if locale is an unsupported value.
//   3. createClient() in the page body — same throw conditions.
//   4. Inline supabase.from(...) chains — throw on network / auth glitch.
//
// New architecture: all data fetching lives in a single async function
// `loadUsagePageData()` that returns a SAFE shape with sane defaults on
// every error path. The page render uses whatever that function returns
// — it can never throw because every external call is wrapped.
//
// Net effect: the page WILL render even if migrations are behind, RLS is
// misconfigured, env vars are missing, or Supabase is rate-limiting. In
// the worst case the user sees "Aún no tienes consumo registrado" with
// zero balance. A second-level error.tsx in the parent dir is still the
// backstop for anything I haven't anticipated.

import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getSessionUser, type SubscriptionTier, type UserRole } from '@/lib/auth/session';
import { effectiveTier, isAdminRole } from '@/lib/billing/tiers';
import { getTokenBalance, type TokenBalance } from '@/lib/usage/tokens';
import { createClient } from '@/lib/supabase/server';
import { TokenPackBuyButton } from '@/components/workspace/token-pack-buy-button';
import { TOKEN_PACKS } from '@/lib/payments/pricing';
import {
  getCurrentAccrualsForPartner,
  getPayoutsForPartner,
  type PayoutRow,
  type RoyaltyAccrual,
} from '@/lib/usage/royalties';

export const metadata = { title: 'Uso' };

interface UsageEventRow {
  id: string;
  engine_id: string;
  kind: string;
  amount: number;
  occurred_at: string;
  operation: string | null;
}

// One "run" = group of usage events sharing (engine_id, operation, date).
// Renders as a single row showing total cost + call count. Events without
// an operation tag render individually (one row each), same as before.
interface RunGroup {
  key: string;
  engineId: string;
  operation: string;
  occurredAt: string;
  count: number;
  totalAmount: number;
  kinds: Set<string>;
}

interface PageData {
  /** True when getSessionUser() succeeded AND returned a user. */
  hasSession: boolean;
  userId: string | null;
  role: UserRole;
  tier: SubscriptionTier;
  isAdmin: boolean;
  balance: TokenBalance;
  events: UsageEventRow[];
  engineMap: Map<string, { name: string; icon: string }>;
  royaltyAccruals: RoyaltyAccrual[];
  royaltyPayouts: PayoutRow[];
  /** When any of the fetches errored, the operator-visible reason. Logged
   *  to Vercel Functions logs but NOT shown to the user — the surface
   *  silently degrades to default values instead. */
  warnings: string[];
}

const DEFAULT_BALANCE: TokenBalance = {
  remaining: 0,
  unlimited: false,
  monthlyAllocation: 0,
  bonus: 0,
  monthlyUsed: 0,
  periodStart: new Date().toISOString(),
};

const KIND_LABEL: Record<string, string> = {
  'llm.tokens': 'LLM tokens',
  'storage.mb': 'Storage',
  'publish.count': 'Publish',
};

function formatNumber(n: number): string {
  return n.toLocaleString('es-MX');
}

function relativeDate(iso: string, locale: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Load every piece of data the page needs, with bulletproof error handling.
 * Each external call is independently try/caught — a failure in one doesn't
 * cascade. Returns a PageData object the render layer can consume without
 * ever encountering an undefined property.
 *
 * Errors are accumulated in `warnings` and console.error'd with a
 * `[/app/usage]` prefix so they're greppable in Vercel Function logs.
 */
async function loadUsagePageData(): Promise<PageData> {
  const warnings: string[] = [];

  // ── Session ─────────────────────────────────────────────────────────
  // The ONE thing we don't catch is the not-authenticated case — when
  // there's no session at all, the caller should redirect to /sign-in.
  // The try/catch here covers a thrown auth error (createClient missing
  // env vars, supabase auth fetch network error, etc).
  let session: Awaited<ReturnType<typeof getSessionUser>> = null;
  try {
    session = await getSessionUser();
  } catch (err) {
    console.error('[/app/usage] getSessionUser threw:', err);
    warnings.push('session_lookup_failed');
  }

  if (!session) {
    return {
      hasSession: false,
      userId: null,
      role: 'VIEWER',
      tier: 'FREE',
      isAdmin: false,
      balance: DEFAULT_BALANCE,
      events: [],
      engineMap: new Map(),
      royaltyAccruals: [],
      royaltyPayouts: [],
      warnings,
    };
  }

  const userId = session.user.id;
  const role = session.role;
  const storedTier = session.tier;
  const tier = effectiveTier(role, storedTier);
  const isAdmin = isAdminRole(role);

  // ── Balance + royalties (parallel) ──────────────────────────────────
  const [balance, royaltyAccruals, royaltyPayouts] = await Promise.all([
    getTokenBalance(userId).catch((err) => {
      console.error('[/app/usage] getTokenBalance threw:', err);
      warnings.push('balance_lookup_failed');
      return DEFAULT_BALANCE;
    }),
    getCurrentAccrualsForPartner(userId).catch((err) => {
      console.error('[/app/usage] getCurrentAccrualsForPartner threw:', err);
      warnings.push('royalty_accruals_lookup_failed');
      return [] as RoyaltyAccrual[];
    }),
    getPayoutsForPartner(userId).catch((err) => {
      console.error('[/app/usage] getPayoutsForPartner threw:', err);
      warnings.push('royalty_payouts_lookup_failed');
      return [] as PayoutRow[];
    }),
  ]);

  // ── Usage events ────────────────────────────────────────────────────
  // Defensive supabase client init.
  let events: UsageEventRow[] = [];
  const engineMap = new Map<string, { name: string; icon: string }>();
  try {
    const supabase = await createClient();
    // Try with `operation` column (migration 0015). On column-missing
    // error code 42703, fall back to legacy columns so the activity feed
    // still renders ungrouped.
    let rawEvents: unknown[] | null = null;
    try {
      const first = await supabase
        .from('usage_events')
        .select('id, engine_id, kind, amount, occurred_at, operation')
        .eq('user_id', userId)
        .order('occurred_at', { ascending: false })
        .limit(60);
      if (first.error) {
        console.warn(
          '[/app/usage] usage_events with operation failed, retrying legacy:',
          first.error.message,
        );
        const legacy = await supabase
          .from('usage_events')
          .select('id, engine_id, kind, amount, occurred_at')
          .eq('user_id', userId)
          .order('occurred_at', { ascending: false })
          .limit(60);
        if (legacy.error) {
          console.error('[/app/usage] usage_events legacy also failed:', legacy.error.message);
          warnings.push('events_query_failed');
        } else {
          rawEvents = legacy.data;
        }
      } else {
        rawEvents = first.data;
      }
    } catch (err) {
      console.error('[/app/usage] usage_events query threw:', err);
      warnings.push('events_query_threw');
    }
    events = (rawEvents ?? []) as UsageEventRow[];

    // Hydrate engine names from the events we got back.
    const engineIds = Array.from(new Set(events.map((e) => e.engine_id).filter(Boolean)));
    if (engineIds.length > 0) {
      try {
        const enginesRes = await supabase
          .from('engines')
          .select('id, name, icon')
          .in('id', engineIds);
        if (enginesRes.error) {
          console.warn('[/app/usage] engines lookup error:', enginesRes.error.message);
          warnings.push('engines_lookup_failed');
        } else {
          for (const e of enginesRes.data ?? []) {
            engineMap.set(e.id as string, {
              name: (e.name as string) ?? 'Engine',
              icon: (e.icon as string | null) ?? '◆',
            });
          }
        }
      } catch (err) {
        console.error('[/app/usage] engines lookup threw:', err);
        warnings.push('engines_lookup_threw');
      }
    }
  } catch (err) {
    console.error('[/app/usage] createClient threw:', err);
    warnings.push('supabase_client_init_failed');
  }

  return {
    hasSession: true,
    userId,
    role,
    tier,
    isAdmin,
    balance,
    events,
    engineMap,
    royaltyAccruals,
    royaltyPayouts,
    warnings,
  };
}

export default async function UsagePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  // Param parsing — could throw if Next gives us a weird shape; default safely.
  let locale = 'es';
  let paymentStatus: string | undefined = undefined;
  try {
    const p = await params;
    locale = p.locale || 'es';
    const sp = await searchParams;
    paymentStatus = sp.status;
  } catch (err) {
    console.error('[/app/usage] params parsing failed:', err);
  }

  // setRequestLocale can throw if locale isn't in the supported list. We
  // accept whatever Next gave us but never let it crash the page.
  try {
    setRequestLocale(locale);
  } catch (err) {
    console.error('[/app/usage] setRequestLocale failed:', err);
  }

  const data = await loadUsagePageData();

  // No session = redirect to sign-in. `redirect()` throws internally
  // (intended NEXT_REDIRECT) and is the only error we WANT to bubble.
  if (!data.hasSession) {
    redirect('/sign-in?next=/app/usage');
  }

  // Collapse events into runs. Pure JS — no external calls, can't throw.
  type Row = { kind: 'run'; group: RunGroup } | { kind: 'event'; event: UsageEventRow };
  const runMap = new Map<string, RunGroup>();
  const standalone: UsageEventRow[] = [];
  for (const e of data.events) {
    if (!e.operation) {
      standalone.push(e);
      continue;
    }
    const date = (e.occurred_at || '').slice(0, 10);
    const key = `${e.engine_id}|${e.operation}|${date}`;
    const existing = runMap.get(key);
    if (existing) {
      existing.count += 1;
      existing.totalAmount += e.amount;
      existing.kinds.add(e.kind);
      if (e.occurred_at < existing.occurredAt) existing.occurredAt = e.occurred_at;
    } else {
      runMap.set(key, {
        key,
        engineId: e.engine_id,
        operation: e.operation,
        occurredAt: e.occurred_at,
        count: 1,
        totalAmount: e.amount,
        kinds: new Set([e.kind]),
      });
    }
  }
  const rows: Row[] = [
    ...Array.from(runMap.values()).map((g) => ({ kind: 'run' as const, group: g })),
    ...standalone.map((e) => ({ kind: 'event' as const, event: e })),
  ].sort((a, b) => {
    const ta = a.kind === 'run' ? a.group.occurredAt : a.event.occurred_at;
    const tb = b.kind === 'run' ? b.group.occurredAt : b.event.occurred_at;
    return (tb || '').localeCompare(ta || '');
  });
  const visibleRows = rows.slice(0, 25);

  const now = new Date();
  const periodLabel = now.toLocaleDateString('es-MX', {
    month: 'long',
    year: 'numeric',
  });

  const { balance, isAdmin, tier, royaltyAccruals, royaltyPayouts, engineMap } = data;

  const usedPct = balance.unlimited
    ? 0
    : balance.monthlyAllocation > 0
      ? Math.min(100, (balance.monthlyUsed / balance.monthlyAllocation) * 100)
      : 0;
  const overSoon = !balance.unlimited && usedPct > 80;

  return (
    <div className="cc-scroll">
      {/* Post-checkout return banner */}
      {paymentStatus === 'success' && (
        <div
          style={{
            padding: '14px 18px',
            border: '1px solid var(--cc-green)',
            background: 'var(--cc-green-g)',
            borderRadius: 'var(--cc-r-l)',
            marginBottom: 18,
            color: 'var(--cc-txt-2)',
            fontSize: 13,
          }}
        >
          ● <b style={{ color: 'var(--cc-green)' }}>Pago recibido</b> — tus tokens se suman a tu
          balance en cuanto Mercado Pago confirma (de segundos a minutos). Esta página se actualiza
          sola.
        </div>
      )}

      {/* Top stats */}
      <div className="cc-mod-statgrid">
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Periodo</div>
          <div className="cc-mod-stat-v">{periodLabel}</div>
          <div className="cc-mod-stat-sub">se renueva el 1° del próximo mes</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Balance disponible</div>
          <div className={`cc-mod-stat-v ${balance.unlimited ? 'pu' : overSoon ? 'am' : 'gr'}`}>
            {balance.unlimited ? '∞' : formatNumber(balance.remaining)}
          </div>
          <div className="cc-mod-stat-sub">
            {balance.unlimited
              ? `admin · sin límite (usados: ${formatNumber(balance.monthlyUsed)})`
              : `de ${formatNumber(balance.monthlyAllocation + balance.bonus)} tokens este mes`}
          </div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Tokens bonus</div>
          <div className={`cc-mod-stat-v ${balance.bonus > 0 ? 'cy' : ''}`}>
            {formatNumber(balance.bonus)}
          </div>
          <div className="cc-mod-stat-sub">
            {balance.bonus > 0 ? 'tokens extra comprados · no caducan' : 'aún no compras tokens extra'}
          </div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Plan</div>
          <div className="cc-mod-stat-v gr">{tier.replace('_', '-')}</div>
          <div className="cc-mod-stat-sub">
            {balance.unlimited
              ? 'sin límite por tu rol'
              : `incluye ${formatNumber(balance.monthlyAllocation)} tokens al mes`}
          </div>
        </div>
      </div>

      {/* Progress bar — hide for admins (no meaningful limit) */}
      {!balance.unlimited && (
        <div className="cc-mod-section">
          <div className="cc-mod-sl">Consumo del mes</div>
          <div
            style={{
              padding: '18px 20px',
              border: `1px solid var(--cc-line-2)`,
              background: 'var(--cc-panel)',
              borderRadius: 'var(--cc-r-l)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--cc-txt-2)' }}>
                <b>{formatNumber(balance.monthlyUsed)}</b> usados ·{' '}
                <b>{formatNumber(balance.remaining)}</b> te quedan
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  fontFamily: 'var(--cc-mono), monospace',
                  color: overSoon ? 'var(--cc-amber)' : 'var(--cc-txt-3)',
                }}
              >
                {usedPct.toFixed(1)}% gastado
              </span>
            </div>
            <span className="cc-bar-track" style={{ display: 'block', width: '100%' }}>
              <span
                className={`cc-bar-fill ${overSoon ? 'am' : 'gr'}`}
                style={{ width: `${usedPct}%` }}
              />
            </span>
            {overSoon && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: 'var(--cc-amber)',
                  fontFamily: 'var(--cc-mono), monospace',
                }}
              >
                ▸ Ya casi llegas a tu límite. Compra tokens extra para no quedarte sin servicio cuando se acaben.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Buy top-up packs — hidden for admins */}
      {!isAdmin && (
        <div className="cc-mod-section">
          <div className="cc-mod-sl">Comprar tokens extra</div>
          <p
            style={{
              fontSize: 12.5,
              color: 'var(--cc-txt-3)',
              maxWidth: '64ch',
              lineHeight: 1.55,
              marginBottom: 14,
            }}
          >
            Los tokens que compras <b>nunca caducan</b> y se usan <b>después</b> de los tokens que
            ya trae tu plan cada mes. Sirven en todos los engines (ChalybClip y los que vengan después).
          </p>
          <div className="cc-mod-grid">
            {TOKEN_PACKS.map((pack) => (
              <div
                key={pack.id}
                className="cc-mod-card"
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <div className="cc-mod-card-head">
                  <h4 style={{ fontSize: 16 }}>{pack.label}</h4>
                  <span className="cc-mod-badge gr">
                    ${(pack.amountCents / 100).toLocaleString('es-MX')} MXN
                  </span>
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--cc-txt-3)', minHeight: 36 }}>
                  {pack.tagline}
                </p>
                <div className="cc-mod-meta">
                  <span>
                    <b>{formatNumber(pack.tokens)}</b> tokens
                  </span>
                  <span style={{ fontFamily: 'var(--cc-mono), monospace', fontSize: 10.5 }}>
                    ≈ ${((pack.amountCents / 100 / (pack.tokens / 1000)).toFixed(2))} MXN/1k tokens
                  </span>
                </div>
                <TokenPackBuyButton packId={pack.id} packLabel={pack.label} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Partner royalty section — only renders if this user owns an
          engine with a non-zero royalty rate. */}
      {(royaltyAccruals.length > 0 || royaltyPayouts.length > 0) && (
        <div className="cc-mod-section">
          <div className="cc-mod-sl">Royalties · tus engines</div>
          <p
            style={{
              fontSize: 12.5,
              color: 'var(--cc-txt-3)',
              maxWidth: '64ch',
              lineHeight: 1.55,
              marginBottom: 14,
            }}
          >
            Como dueño de uno o más engines, ganas regalías cada vez que
            otros usuarios gastan tokens en ellos. El admin cierra el
            periodo al final del mes y procesa el pago por fuera.
          </p>
          {royaltyAccruals.length > 0 && (
            <div className="cc-mod-list" style={{ marginBottom: 14 }}>
              {royaltyAccruals.map((a) => (
                <div key={a.engineId} className="cc-mod-row">
                  <div className="cc-mod-ic">◆</div>
                  <div className="cc-mod-body">
                    <div className="cc-mod-name">
                      {a.engineName}{' '}
                      <span className="cc-mod-badge">
                        {a.alreadyFinalized ? 'cerrado' : 'acumulando'}
                      </span>
                    </div>
                    <div className="cc-mod-sub">
                      {formatNumber(a.tokensThisPeriod)} tokens este mes · rate{' '}
                      <code>
                        ${(a.ratePerMillionCents / 100).toLocaleString('es-MX')}/1M
                      </code>
                    </div>
                  </div>
                  <div className="cc-mod-right">
                    <b className={a.alreadyFinalized ? 'gr' : 'am'}>
                      ${(a.accruedCents / 100).toLocaleString('es-MX')}
                    </b>
                    <span>MXN este periodo</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {royaltyPayouts.length > 0 && (
            <details>
              <summary
                style={{
                  cursor: 'pointer',
                  color: 'var(--cc-txt-3)',
                  fontSize: 12.5,
                  marginBottom: 10,
                }}
              >
                Historial de pagos ({royaltyPayouts.length})
              </summary>
              <div className="cc-mod-list">
                {royaltyPayouts.map((p) => (
                  <div key={p.id} className="cc-mod-row">
                    <div className="cc-mod-ic">
                      {p.status === 'paid' ? '✓' : p.status === 'cancelled' ? '✕' : '◷'}
                    </div>
                    <div className="cc-mod-body">
                      <div className="cc-mod-name">
                        {p.engineName}{' '}
                        <span className={`cc-mod-badge ${p.status === 'paid' ? 'gr' : ''}`}>
                          {p.status}
                        </span>
                      </div>
                      <div className="cc-mod-sub">
                        Periodo{' '}
                        {new Date(p.periodStart).toLocaleDateString('es-MX', {
                          month: 'long',
                          year: 'numeric',
                        })}{' '}
                        · {formatNumber(p.tokensAttributed)} tokens
                        {p.paymentReference && (
                          <>
                            {' '}
                            · ref <code>{p.paymentReference}</code>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="cc-mod-right">
                      <b className={p.status === 'paid' ? 'gr' : ''}>
                        ${(p.amountCents / 100).toLocaleString('es-MX')}
                      </b>
                      <span>MXN</span>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Recent usage events — collapsed into runs when engine tags them. */}
      <div className="cc-mod-section">
        <div className="cc-mod-sl">Actividad reciente</div>
        {visibleRows.length === 0 ? (
          <div
            style={{
              padding: '32px 22px',
              border: '1px dashed var(--cc-line-2)',
              borderRadius: 'var(--cc-r-l)',
              textAlign: 'center',
              color: 'var(--cc-txt-3)',
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            Todavía no registras consumo este mes.
            <br />
            <span
              style={{
                color: 'var(--cc-txt-4)',
                fontSize: 11.5,
                fontFamily: 'var(--cc-mono), monospace',
                marginTop: 6,
                display: 'inline-block',
              }}
            >
              Tu actividad aparece aquí en cuanto un engine empiece a usar tokens.
            </span>
          </div>
        ) : (
          <div className="cc-mod-list">
            {visibleRows.map((row) => {
              if (row.kind === 'run') {
                const g = row.group;
                const eng = engineMap.get(g.engineId);
                return (
                  <div key={g.key} className="cc-mod-row">
                    <div className="cc-mod-ic">{eng?.icon ?? '◆'}</div>
                    <div className="cc-mod-body">
                      <div className="cc-mod-name">
                        {eng?.name ?? 'Engine'}{' '}
                        <span className="cc-mod-badge">{g.operation}</span>{' '}
                        <span className="cc-mod-badge gr">
                          {g.count} llamada{g.count === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="cc-mod-sub">
                        {relativeDate(g.occurredAt, locale)} ·{' '}
                        {Array.from(g.kinds)
                          .map((k) => KIND_LABEL[k] ?? k)
                          .join(' · ')}
                      </div>
                    </div>
                    <div className="cc-mod-right">
                      <b className="cy">{formatNumber(g.totalAmount)}</b>
                      <span>tokens · run</span>
                    </div>
                  </div>
                );
              }
              const e = row.event;
              const eng = engineMap.get(e.engine_id);
              return (
                <div key={e.id} className="cc-mod-row">
                  <div className="cc-mod-ic">{eng?.icon ?? '◆'}</div>
                  <div className="cc-mod-body">
                    <div className="cc-mod-name">
                      {eng?.name ?? 'Engine'}{' '}
                      <span className="cc-mod-badge">{KIND_LABEL[e.kind] ?? e.kind}</span>
                    </div>
                    <div className="cc-mod-sub">{relativeDate(e.occurred_at, locale)}</div>
                  </div>
                  <div className="cc-mod-right">
                    <b>{formatNumber(e.amount)}</b>
                    <span>{e.kind.split('.')[1] ?? 'units'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Diagnostic strip — only when something actually went wrong. Lives at
          the bottom so it doesn't push the primary surface around. Helps the
          operator see which subsystem fell over without exposing internals. */}
      {data.warnings.length > 0 && (
        <div
          style={{
            marginTop: 18,
            padding: '8px 12px',
            background: 'var(--cc-amber-g, rgba(245,177,61,0.06))',
            border: '1px solid rgba(245,177,61,0.25)',
            borderRadius: 7,
            fontSize: 11,
            color: 'var(--cc-amber, #f5b13d)',
            fontFamily: 'var(--cc-mono), monospace',
            lineHeight: 1.5,
          }}
        >
          ▸ Algunos datos se mostraron con valores por defecto (
          {data.warnings.join(', ')}). Si esto sigue pasando, revisa los logs de
          Vercel — busca por el prefijo `[/app/usage]`.
        </div>
      )}
    </div>
  );
}
