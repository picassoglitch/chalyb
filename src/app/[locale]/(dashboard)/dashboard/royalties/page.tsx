// Admin royalties page — shows live accruals + finalized payouts in one place.
// Only ADMIN/SUPER_ADMIN reach here (dashboard layout gates the whole tree).

import { setRequestLocale } from 'next-intl/server';
import { getCurrentPeriodAccruals, getPayoutHistory } from '@/lib/usage/royalties';
import { RoyaltyFinalizeButton } from '@/components/dashboard/royalty-finalize-button';
import { RoyaltyPayoutActions } from '@/components/dashboard/royalty-payout-actions';

export const metadata = { title: 'Royalties' };

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('es-MX', { maximumFractionDigits: 2 })} MXN`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString('es-MX');
}

function formatPeriod(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
}

function displayName(p: { partnerName: string | null; partnerEmail: string | null }): string {
  if (p.partnerName) return p.partnerName;
  if (p.partnerEmail) return p.partnerEmail.split('@')[0]!;
  return 'Socio sin nombre';
}

export default async function RoyaltiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [summary, history] = await Promise.all([
    getCurrentPeriodAccruals(),
    getPayoutHistory(50),
  ]);

  const accruableTotal = summary.accruals
    .filter((a) => !a.alreadyFinalized)
    .reduce((sum, a) => sum + a.accruedCents, 0);
  const alreadyFinalizedTotal = summary.accruals
    .filter((a) => a.alreadyFinalized)
    .reduce((sum, a) => sum + a.accruedCents, 0);
  const totalThisPeriod = accruableTotal + alreadyFinalizedTotal;

  return (
    <div className="cc-scroll">
      {/* ── Top stats ─────────────────────────────────────────────────── */}
      <div className="cc-mod-statgrid">
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Mes en curso</div>
          <div className="cc-mod-stat-v">{formatPeriod(summary.periodStart)}</div>
          <div className="cc-mod-stat-sub">según el uso registrado</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Por pagar este mes</div>
          <div className={`cc-mod-stat-v ${accruableTotal > 0 ? 'am' : ''}`}>
            {formatCents(accruableTotal)}
          </div>
          <div className="cc-mod-stat-sub">
            {summary.partnersWithAccrual} socio
            {summary.partnersWithAccrual === 1 ? '' : 's'} con saldo a favor
          </div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Ya cerrado</div>
          <div className={`cc-mod-stat-v ${alreadyFinalizedTotal > 0 ? 'gr' : ''}`}>
            {formatCents(alreadyFinalizedTotal)}
          </div>
          <div className="cc-mod-stat-sub">ya guardado como pago</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Total del mes</div>
          <div className="cc-mod-stat-v">{formatCents(totalThisPeriod)}</div>
          <div className="cc-mod-stat-sub">por pagar + ya cerrado</div>
        </div>
      </div>

      {/* ── Live accruals ─────────────────────────────────────────────── */}
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
            Ganancias en vivo · {formatPeriod(summary.periodStart)}
          </div>
          <RoyaltyFinalizeButton accruableCount={summary.accruals.filter((a) => a.accruedCents > 0 && !a.alreadyFinalized).length} />
        </div>
        <p
          style={{
            fontSize: 12.5,
            color: 'var(--cc-txt-3)',
            maxWidth: '76ch',
            lineHeight: 1.55,
            marginBottom: 14,
          }}
        >
          Cada fila se calcula como <code>tokens consumidos × tarifa / 1M</code>. La
          tarifa (centavos por millón) la defines en cada engine. Cuando das clic en{' '}
          <b>Finalizar</b>, lo acumulado hasta ese momento se guarda en{' '}
          <code>engine_royalty_payouts</code> como pago pendiente — los pagos se
          procesan aparte más tarde.
        </p>
        {summary.accruals.length === 0 ? (
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
            Aún no hay ganancias — ningún engine con tarifa &gt; 0 tiene un socio asignado.
            <br />
            <span style={{ color: 'var(--cc-txt-4)', fontSize: 11.5, fontFamily: 'var(--cc-mono), monospace', marginTop: 6, display: 'inline-block' }}>
              Configura: dashboard → Engines → set partner_royalty_per_million_tokens_cents.
            </span>
          </div>
        ) : (
          <div className="cc-mod-list">
            {summary.accruals.map((a) => (
              <div key={a.engineId} className="cc-mod-row">
                <div className="cc-mod-ic">{a.alreadyFinalized ? '✓' : '⌬'}</div>
                <div className="cc-mod-body">
                  <div className="cc-mod-name">
                    {a.engineName}{' '}
                    <span className="cc-mod-badge">{a.engineSlug}</span>
                    {a.alreadyFinalized && (
                      <span className="cc-mod-badge gr">cerrado</span>
                    )}
                  </div>
                  <div className="cc-mod-sub">
                    Socio: <b>{displayName(a)}</b> · tarifa{' '}
                    <code>{formatCents(a.ratePerMillionCents)}</code> / 1M tokens
                  </div>
                </div>
                <div className="cc-mod-right">
                  <b className={a.accruedCents > 0 ? (a.alreadyFinalized ? 'gr' : 'am') : ''}>
                    {formatCents(a.accruedCents)}
                  </b>
                  <span>{formatTokens(a.tokensThisPeriod)} tokens</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Payout history ────────────────────────────────────────────── */}
      <div className="cc-mod-section">
        <div className="cc-mod-sl">Historial de pagos · últimos 50</div>
        {history.length === 0 ? (
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
            Todavía no hay pagos registrados. Aparecen aquí cuando cierras el primer mes.
          </div>
        ) : (
          <div className="cc-mod-list">
            {history.map((p) => (
              <div key={p.id} className="cc-mod-row" style={{ alignItems: 'flex-start' }}>
                <div className="cc-mod-ic">{statusGlyph(p.status)}</div>
                <div className="cc-mod-body">
                  <div className="cc-mod-name">
                    {p.engineName}{' '}
                    <span className="cc-mod-badge">{p.engineSlug}</span>{' '}
                    <span className={`cc-mod-badge ${statusBadgeClass(p.status)}`}>
                      {p.status}
                    </span>
                  </div>
                  <div className="cc-mod-sub">
                    Socio: <b>{displayName(p)}</b> · mes{' '}
                    <code>{formatPeriod(p.periodStart)}</code> ·{' '}
                    {formatTokens(p.tokensAttributed)} tokens
                  </div>
                  {p.paymentReference && (
                    <div className="cc-mod-sub" style={{ marginTop: 4 }}>
                      Ref: <code>{p.paymentReference}</code>
                      {p.paidAt && (
                        <> · pagado el {new Date(p.paidAt).toLocaleDateString('es-MX')}</>
                      )}
                    </div>
                  )}
                  {p.adminNotes && (
                    <div className="cc-mod-sub" style={{ marginTop: 4, color: 'var(--cc-txt-4)' }}>
                      Notas: {p.adminNotes}
                    </div>
                  )}
                </div>
                <div className="cc-mod-right">
                  <b className={p.status === 'paid' ? 'gr' : p.status === 'cancelled' ? '' : 'am'}>
                    {formatCents(p.amountCents)}
                  </b>
                  {p.status === 'pending' && (
                    <RoyaltyPayoutActions payoutId={p.id} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function statusGlyph(status: 'pending' | 'paid' | 'cancelled'): string {
  if (status === 'paid') return '✓';
  if (status === 'cancelled') return '✕';
  return '◷';
}

function statusBadgeClass(status: 'pending' | 'paid' | 'cancelled'): string {
  if (status === 'paid') return 'gr';
  if (status === 'cancelled') return '';
  return 'am';
}
