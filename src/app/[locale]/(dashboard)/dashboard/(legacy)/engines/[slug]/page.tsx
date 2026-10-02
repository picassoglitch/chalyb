// Per-engine admin detail page.
//
// Shows the admin everything they'd want to know about one engine in
// production: subscriber counts, token + revenue numbers, operational
// cost breakdown with margin, top users, recent activity. Admin can
// also edit the cost rates inline so the margin updates without
// leaving the page.
//
// Auth: parent dashboard layout already gates the whole tree to
// SUPER_ADMIN / ADMIN, but we redirect defensively anyway.

import { setRequestLocale } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { listEngines } from '@/lib/data/engines';
import { getEngineMetrics } from '@/lib/engines/admin-metrics';
import {
  EngineCostRateInput,
  EngineFixedCostInput,
  EngineRoyaltyRateInput,
  EngineStatusSelect,
  EngineTierSelect,
} from '@/components/dashboard/engine-admin-controls';
import { AnthropicSyncButton } from '@/components/dashboard/anthropic-sync-button';

export const metadata = { title: 'Engine · admin' };

function formatCents(cents: number, opts: { minimumFractionDigits?: number } = {}): string {
  const pesos = cents / 100;
  return `$${pesos.toLocaleString('es-MX', {
    minimumFractionDigits: opts.minimumFractionDigits ?? 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString('es-MX');
}

function relativeDate(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATE_LABEL: Record<string, { label: string; cls: string }> = {
  HEALTHY: { label: 'Healthy', cls: 'gr' },
  TRAINING: { label: 'Training', cls: '' },
  RENDERING: { label: 'Rendering', cls: '' },
  DELAYED: { label: 'Delayed', cls: 'am' },
  ERROR: { label: 'Error', cls: 'r' },
  OFFLINE: { label: 'Offline', cls: '' },
};

export default async function EngineDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const session = await getSessionUser();
  if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN')) {
    redirect('/app');
  }

  const engines = await listEngines();
  const engine = engines.find((e) => e.slug === slug);
  if (!engine) notFound();

  const metrics = await getEngineMetrics({
    engineId: engine.id,
    costPerMillionTokensCents: engine.costPerMillionTokensCents,
    fixedMonthlyCostCents: engine.fixedMonthlyCostCents,
    partnerRoyaltyPerMillionTokensCents: engine.partnerRoyaltyPerMillionTokensCents,
  });

  const stateMeta = STATE_LABEL[engine.state] ?? { label: engine.state, cls: '' };
  const marginColor =
    metrics.marginPct === null
      ? ''
      : metrics.marginPct >= 50
        ? 'gr'
        : metrics.marginPct >= 0
          ? 'am'
          : 'r';

  return (
    <div className="cc-scroll">
      {/* ── Header row: identity + nav back ───────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <Link
          href={'/dashboard/engines' as Route}
          style={{
            color: 'var(--cc-txt-3)',
            fontSize: 12,
            textDecoration: 'none',
            fontFamily: 'var(--cc-mono), monospace',
          }}
        >
          ← Engines
        </Link>
        <div style={{ fontSize: 28, lineHeight: 1 }}>{engine.icon}</div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 600,
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            {engine.name}
          </h2>
          <div
            style={{
              fontSize: 12,
              color: 'var(--cc-txt-3)',
              marginTop: 4,
              fontFamily: 'var(--cc-mono), monospace',
            }}
          >
            <code>{engine.slug}</code> · {engine.category} · {engine.region}
            {engine.node !== '—' && ` · ${engine.node}`}
          </div>
        </div>
        <span className={`cc-mod-badge ${stateMeta.cls}`}>{stateMeta.label}</span>
        <span className="cc-mod-badge">tier · {engine.tierRequired.replace('_', '-')}</span>
        {/* Subscriber-view link — admin still wants to be able to "use it
            as a regular user" for QA. Lives here so the main dashboard
            link goes to the operational view instead. */}
        <Link
          href={`/app/engines/${engine.slug}` as Route}
          style={{
            padding: '7px 12px',
            borderRadius: 7,
            border: '1px solid var(--cc-line-2)',
            background: 'transparent',
            color: 'var(--cc-txt-2)',
            fontSize: 12,
            textDecoration: 'none',
            fontFamily: 'inherit',
          }}
          title="Abre la vista del subscriber para ver cómo se ve para ellos"
        >
          Ver como subscriber →
        </Link>
      </div>

      {/* ── Stat grid: top-line operational numbers ───────────────────── */}
      <div className="cc-mod-statgrid">
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Subs activas</div>
          <div className={`cc-mod-stat-v ${metrics.activeSubs > 0 ? 'gr' : ''}`}>
            {metrics.activeSubs}
            <small> / {metrics.totalSubs} total</small>
          </div>
          <div className="cc-mod-stat-sub">
            {metrics.pausedSubs} en pausa · {metrics.newSubsThisMonth} nuevas este mes
          </div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Usuarios activos · mes</div>
          <div className={`cc-mod-stat-v ${metrics.usersActiveThisMonth > 0 ? 'cy' : ''}`}>
            {metrics.usersActiveThisMonth}
          </div>
          <div className="cc-mod-stat-sub">usaron al menos 1 token este mes</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Tokens · mes</div>
          <div className={`cc-mod-stat-v ${metrics.tokensThisMonth > 0 ? 'cy' : ''}`}>
            {formatTokens(metrics.tokensThisMonth)}
          </div>
          <div className="cc-mod-stat-sub">
            {formatTokens(metrics.tokensLast7d)} en 7 días ·{' '}
            {formatTokens(metrics.tokensLifetime)} histórico
          </div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Ingresos · mes</div>
          <div className={`cc-mod-stat-v ${metrics.revenueCentsThisMonth > 0 ? 'gr' : ''}`}>
            {formatCents(metrics.revenueCentsThisMonth)}
          </div>
          <div className="cc-mod-stat-sub">aprox · pagos de las subs activas</div>
        </div>
      </div>

      {/* ── Cost + margin panel ───────────────────────────────────────── */}
      <div className="cc-mod-section">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 12,
            flexWrap: 'wrap',
          }}
        >
          <div className="cc-mod-sl" style={{ marginBottom: 0 }}>
            Costo operativo · este mes
          </div>
          <small
            style={{
              fontFamily: 'var(--cc-mono), monospace',
              fontSize: 10.5,
              color: 'var(--cc-txt-4)',
              letterSpacing: '0.08em',
            }}
          >
            CALCULADO A LAS {new Date(metrics.computedAt).toLocaleString('es-MX', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </small>
        </div>
        <p
          style={{
            fontSize: 12.5,
            color: 'var(--cc-txt-3)',
            maxWidth: '78ch',
            lineHeight: 1.55,
            marginBottom: 16,
          }}
        >
          Lo que la plataforma le paga a los proveedores (Claude API, Modal,
          infra) más el royalty del partner dueño del engine. Edita los costos
          aquí mismo y el margen se recalcula solo. Vercel y Railway suelen
          entrar en el <b>costo fijo</b> mensual. Hoy el costo de Claude está en
          <b>$180 MXN / 1M tokens</b> (Sonnet 4.5).
        </p>

        {/* Editable rate row */}
        <div
          style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            padding: '12px 14px',
            border: '1px solid var(--cc-line-2)',
            background: 'var(--cc-panel)',
            borderRadius: 'var(--cc-r-l)',
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 10.5,
                fontFamily: 'var(--cc-mono), monospace',
                color: 'var(--cc-txt-4)',
                letterSpacing: '.08em',
                textTransform: 'uppercase',
              }}
            >
              Costo / 1M tokens
            </span>
            <EngineCostRateInput
              engineId={engine.id}
              currentCents={engine.costPerMillionTokensCents}
              engineName={engine.name}
            />
            {/* Anthropic sync — only worth showing for LLM-heavy engines.
                Hits org admin API for last 30d cost+usage, computes
                blended MXN rate, writes to this engine's row. */}
            <AnthropicSyncButton engineId={engine.id} engineName={engine.name} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 10.5,
                fontFamily: 'var(--cc-mono), monospace',
                color: 'var(--cc-txt-4)',
                letterSpacing: '.08em',
                textTransform: 'uppercase',
              }}
            >
              Fijo / mes
            </span>
            <EngineFixedCostInput
              engineId={engine.id}
              currentCents={engine.fixedMonthlyCostCents}
              engineName={engine.name}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 10.5,
                fontFamily: 'var(--cc-mono), monospace',
                color: 'var(--cc-txt-4)',
                letterSpacing: '.08em',
                textTransform: 'uppercase',
              }}
            >
              Royalty / 1M
            </span>
            <EngineRoyaltyRateInput
              engineId={engine.id}
              currentCents={engine.partnerRoyaltyPerMillionTokensCents}
              engineName={engine.name}
            />
            {engine.ownerDisplayName && (
              <span style={{ fontSize: 11.5, color: 'var(--cc-txt-3)' }}>
                → <b>{engine.ownerDisplayName}</b>
              </span>
            )}
          </div>
        </div>

        {/* Cost breakdown table */}
        <div
          style={{
            border: '1px solid var(--cc-line-2)',
            borderRadius: 'var(--cc-r-l)',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              <CostRow
                label="LLM (variable · proveedor API)"
                note={`${formatTokens(metrics.tokensThisMonth)} tokens × ${formatCents(engine.costPerMillionTokensCents)} / 1M`}
                amountCents={metrics.llmVariableCostCents}
              />
              <CostRow
                label="Infraestructura fija (Modal / Vercel / Railway)"
                note={
                  engine.fixedMonthlyCostCents > 0
                    ? 'La parte que toca este mes'
                    : 'Sin configurar — edítalo arriba'
                }
                amountCents={metrics.fixedMonthlyCostCents}
              />
              <CostRow
                label={
                  engine.ownerDisplayName
                    ? `Royalty al partner (${engine.ownerDisplayName})`
                    : 'Royalty al partner'
                }
                note={
                  engine.ownerUserId
                    ? `${formatTokens(metrics.tokensThisMonth)} × ${formatCents(engine.partnerRoyaltyPerMillionTokensCents)} / 1M`
                    : 'Este engine no tiene partner asignado'
                }
                amountCents={metrics.royaltyPayableCents}
              />
              <tr
                style={{
                  borderTop: '2px solid var(--cc-line-2)',
                  background: 'var(--cc-bg-2)',
                }}
              >
                <td style={tdLabel}>
                  <b>Costo total · mes</b>
                </td>
                <td style={tdNote}></td>
                <td style={{ ...tdAmount, color: 'var(--cc-red, #ff5d5d)' }}>
                  <b>{formatCents(metrics.totalCostCents)}</b>
                </td>
              </tr>
              <tr style={{ background: 'var(--cc-bg-2)' }}>
                <td style={tdLabel}>
                  <b>Margen · ingresos − costo total</b>
                </td>
                <td style={tdNote}>
                  {metrics.marginPct !== null && `${metrics.marginPct.toFixed(1)}% margen`}
                </td>
                <td
                  style={{
                    ...tdAmount,
                    color:
                      metrics.marginCents > 0
                        ? 'var(--cc-green)'
                        : metrics.marginCents < 0
                          ? 'var(--cc-red, #ff5d5d)'
                          : 'var(--cc-txt)',
                  }}
                >
                  <b>{formatCents(metrics.marginCents)}</b>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {metrics.revenueCentsThisMonth === 0 && metrics.totalCostCents > 0 && (
          <p
            style={{
              marginTop: 10,
              padding: '8px 12px',
              fontSize: 12,
              color: 'var(--cc-amber, #f5b13d)',
              background: 'var(--cc-amber-g, rgba(245,177,61,0.08))',
              borderRadius: 7,
              fontFamily: 'var(--cc-mono), monospace',
            }}
          >
            ▸ Sin ingresos este mes — el margen sale negativo porque el costo
            sigue corriendo. Es normal al arrancar; revísalo cuando empiece el cobro.
          </p>
        )}
      </div>

      {/* ── Tokens por operación ──────────────────────────────────────── */}
      {metrics.byOperation.length > 0 && (
        <div className="cc-mod-section">
          <div className="cc-mod-sl">Consumo por operación · mes</div>
          <div className="cc-mod-list">
            {metrics.byOperation.slice(0, 12).map((op) => {
              const pct =
                metrics.tokensThisMonth > 0
                  ? (op.tokens / metrics.tokensThisMonth) * 100
                  : 0;
              return (
                <div
                  key={op.operation}
                  className="cc-mod-row"
                  style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="cc-mod-ic">⌬</div>
                    <div className="cc-mod-body">
                      <div className="cc-mod-name">
                        <code>{op.operation}</code>{' '}
                        <span className="cc-mod-badge">
                          {op.calls} llamada{op.calls === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                    <div className="cc-mod-right">
                      <b className="cy">{formatTokens(op.tokens)}</b>
                      <span>{pct.toFixed(1)}% del total</span>
                    </div>
                  </div>
                  <div
                    style={{
                      height: 4,
                      width: '100%',
                      background: 'var(--cc-bg-3)',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.max(2, pct)}%`,
                        background: 'var(--cc-cyan)',
                        opacity: 0.7,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Top users this month — with per-user cost attribution ─────── */}
      {metrics.topUsers.length > 0 && (
        <div className="cc-mod-section">
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 10,
              flexWrap: 'wrap',
            }}
          >
            <div className="cc-mod-sl" style={{ marginBottom: 0 }}>
              Top usuarios · mes
            </div>
            {engine.costPerMillionTokensCents > 0 ? (
              <small
                style={{
                  fontFamily: 'var(--cc-mono), monospace',
                  fontSize: 10.5,
                  color: 'var(--cc-txt-4)',
                  letterSpacing: '0.06em',
                }}
              >
                COSTO = tokens × {formatCents(engine.costPerMillionTokensCents)} / 1M
              </small>
            ) : (
              <small
                style={{
                  fontSize: 11,
                  color: 'var(--cc-amber, #f5b13d)',
                  fontFamily: 'var(--cc-mono), monospace',
                }}
              >
                ▸ configura el costo arriba para ver cuánto gasta cada usuario
              </small>
            )}
          </div>
          <div className="cc-mod-list">
            {metrics.topUsers.map((u, i) => {
              const display = u.fullName || u.email?.split('@')[0] || u.userId.slice(0, 8);
              const pct =
                metrics.tokensThisMonth > 0
                  ? (u.tokens / metrics.tokensThisMonth) * 100
                  : 0;
              // Highlight high-cost users in amber: a single user
              // representing >40% of the engine's total tokens, OR >$500
              // MXN/month, is a concentration risk worth flagging.
              const concentrationFlag = pct >= 40 || u.costCents >= 50_000;
              return (
                <div key={u.userId} className="cc-mod-row">
                  <div
                    className="cc-mod-ic"
                    style={{
                      fontFamily: 'var(--cc-mono), monospace',
                      fontSize: 11,
                      color: concentrationFlag ? 'var(--cc-amber, #f5b13d)' : 'var(--cc-txt-4)',
                    }}
                  >
                    #{i + 1}
                  </div>
                  <div className="cc-mod-body">
                    <div className="cc-mod-name">
                      {display}{' '}
                      {concentrationFlag && (
                        <span
                          className="cc-mod-badge"
                          style={{
                            color: 'var(--cc-amber, #f5b13d)',
                            borderColor: 'rgba(245,177,61,0.3)',
                          }}
                          title={
                            pct >= 40
                              ? 'Concentración: este usuario es más del 40% del consumo del engine'
                              : 'Gasto mayor a $500 MXN/mes'
                          }
                        >
                          concentración
                        </span>
                      )}
                    </div>
                    <div className="cc-mod-sub">
                      {u.email ?? '—'} · {formatTokens(u.tokens)} tokens · {pct.toFixed(1)}%
                      {u.royaltyShareCents > 0 && (
                        <> · royalty {formatCents(u.royaltyShareCents)}</>
                      )}
                    </div>
                  </div>
                  <div className="cc-mod-right">
                    <b className={u.costCents > 0 ? 'am' : ''}>
                      {engine.costPerMillionTokensCents > 0
                        ? formatCents(u.costCents)
                        : '—'}
                    </b>
                    <span>{engine.costPerMillionTokensCents > 0 ? 'costo del mes' : 'sin costo'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Recent activity ───────────────────────────────────────────── */}
      <div className="cc-mod-section">
        <div className="cc-mod-sl">Actividad reciente · últimos 20 eventos</div>
        {metrics.recentEvents.length === 0 ? (
          <div
            style={{
              padding: '28px 22px',
              border: '1px dashed var(--cc-line-2)',
              borderRadius: 'var(--cc-r-l)',
              textAlign: 'center',
              color: 'var(--cc-txt-3)',
              fontSize: 13,
            }}
          >
            Sin actividad este mes. En cuanto alguien use tokens en este engine,
            los eventos aparecen aquí.
          </div>
        ) : (
          <div className="cc-mod-list">
            {metrics.recentEvents.map((e) => (
              <div key={e.id} className="cc-mod-row">
                <div className="cc-mod-ic">·</div>
                <div className="cc-mod-body">
                  <div className="cc-mod-name">
                    {e.userEmail ?? e.userId.slice(0, 8)}{' '}
                    {e.operation && (
                      <span className="cc-mod-badge">{e.operation}</span>
                    )}
                  </div>
                  <div className="cc-mod-sub">
                    {e.kind} · {relativeDate(e.occurredAt)}
                  </div>
                </div>
                <div className="cc-mod-right">
                  <b>{formatTokens(e.amount)}</b>
                  <span>tokens</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Engine controls — same as the row controls on the list page,
          repeated here so the admin can change tier / status without
          bouncing back. ─────────────────────────────────────────────── */}
      <div className="cc-mod-section">
        <div className="cc-mod-sl">Controles del engine</div>
        <div
          style={{
            display: 'flex',
            gap: 18,
            flexWrap: 'wrap',
            padding: '14px 16px',
            border: '1px solid var(--cc-line-2)',
            background: 'var(--cc-panel)',
            borderRadius: 'var(--cc-r-l)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabel}>Status</span>
            <EngineStatusSelect
              engineId={engine.id}
              current={engine.status}
              engineName={engine.name}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabel}>Tier mínimo</span>
            <EngineTierSelect
              engineId={engine.id}
              current={engine.tierRequired}
              engineName={engine.name}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Local helpers ─────────────────────────────────────────────────────────

const tdLabel: React.CSSProperties = {
  padding: '10px 14px',
  borderBottom: '1px solid var(--cc-line-soft, var(--cc-line))',
  fontSize: 13,
  color: 'var(--cc-txt)',
};
const tdNote: React.CSSProperties = {
  padding: '10px 14px',
  borderBottom: '1px solid var(--cc-line-soft, var(--cc-line))',
  fontSize: 11.5,
  fontFamily: 'var(--cc-mono), monospace',
  color: 'var(--cc-txt-3)',
};
const tdAmount: React.CSSProperties = {
  padding: '10px 14px',
  borderBottom: '1px solid var(--cc-line-soft, var(--cc-line))',
  fontSize: 13,
  textAlign: 'right',
  fontFamily: 'var(--cc-mono), monospace',
  color: 'var(--cc-txt)',
  whiteSpace: 'nowrap',
};

const ctrlLabel: React.CSSProperties = {
  fontFamily: 'var(--cc-mono), monospace',
  fontSize: 10,
  color: 'var(--cc-txt-4)',
  letterSpacing: '.08em',
  textTransform: 'uppercase',
};

function CostRow({
  label,
  note,
  amountCents,
}: {
  label: string;
  note: string;
  amountCents: number;
}) {
  return (
    <tr>
      <td style={tdLabel}>{label}</td>
      <td style={tdNote}>{note}</td>
      <td style={tdAmount}>
        ${(amountCents / 100).toLocaleString('es-MX', { maximumFractionDigits: 2 })}
      </td>
    </tr>
  );
}
