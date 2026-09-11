import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Registro de actividad' };

interface AuditRow {
  id: string;
  action: string;
  actor_id: string | null;
  actor_email: string | null;
  target_user_id: string;
  target_email: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_LABEL: Record<string, { label: string; cls: string }> = {
  'tier.change': { label: 'Plan cambiado por un admin', cls: 'gr' },
  'tier.payment': { label: 'Plan activado con el pago', cls: 'gr' },
  'tier.downgrade': { label: 'El usuario bajó su propio plan', cls: 'am' },
  'role.change': { label: 'Rol cambiado', cls: 'pu' },
  'selected_bot.change': { label: 'Bot en vivo cambiado', cls: 'cy' },
};

function formatDiff(before: Record<string, unknown> | null, after: Record<string, unknown> | null): string {
  if (!before && !after) return '—';
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const parts: string[] = [];
  for (const k of keys) {
    const b = before?.[k];
    const a = after?.[k];
    if (b === a) continue;
    parts.push(`${k}: ${String(b ?? '∅')} → ${String(a ?? '∅')}`);
  }
  return parts.join(' · ') || '—';
}

export default async function AuditPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Role-gate is already done by the parent dashboard layout (redirects
  // non-admins to /app), but double-check here in case someone wires a
  // different layout above this route later.
  const session = await getSessionUser();
  if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN')) {
    redirect('/app');
  }

  const supabase = await createClient();
  const { data: eventsRaw } = await supabase
    .from('audit_events')
    .select('id, action, actor_id, actor_email, target_user_id, target_email, before, after, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  const events = (eventsRaw ?? []) as AuditRow[];

  const byActionCount = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.action] = (acc[e.action] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="cc-scroll">
      <div className="cc-mod-statgrid">
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Movimientos en total</div>
          <div className="cc-mod-stat-v gr">{events.length}</div>
          <div className="cc-mod-stat-sub">los últimos 200</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Cambios de plan</div>
          <div className="cc-mod-stat-v">
            {(byActionCount['tier.change'] ?? 0) +
              (byActionCount['tier.payment'] ?? 0) +
              (byActionCount['tier.downgrade'] ?? 0)}
          </div>
          <div className="cc-mod-stat-sub">admin + pagos + bajadas del propio usuario</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Cambios de rol</div>
          <div className="cc-mod-stat-v pu">{byActionCount['role.change'] ?? 0}</div>
          <div className="cc-mod-stat-sub">ascensos + bajas de rol</div>
        </div>
        <div className="cc-mod-stat">
          <div className="cc-mod-stat-l">Pagos automáticos</div>
          <div className="cc-mod-stat-v cy">{byActionCount['tier.payment'] ?? 0}</div>
          <div className="cc-mod-stat-sub">confirmados por Mercado Pago</div>
        </div>
      </div>

      <div className="cc-mod-section">
        <div className="cc-mod-sl">Movimientos recientes</div>
        {events.length === 0 ? (
          <div
            style={{
              padding: '40px 24px',
              border: '1px dashed var(--cc-line-2)',
              borderRadius: 'var(--cc-r-l)',
              textAlign: 'center',
              color: 'var(--cc-txt-3)',
              fontSize: 13,
            }}
          >
            Todavía no hay movimientos registrados.
            <br />
            <span
              style={{
                color: 'var(--cc-txt-4)',
                fontSize: 12,
                fontFamily: 'var(--cc-mono), monospace',
                marginTop: 6,
                display: 'inline-block',
              }}
            >
              Cada cambio de plan o de rol va a aparecer aquí, del más nuevo al más viejo.
            </span>
          </div>
        ) : (
          <div className="cc-mod-list">
            {events.map((e) => {
              const meta = ACTION_LABEL[e.action] ?? { label: e.action, cls: '' };
              const date = new Date(e.created_at).toLocaleString(
                locale === 'es' ? 'es-MX' : 'en-US',
                {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                },
              );
              const actor = e.actor_email ?? (e.actor_id ? `id:${e.actor_id.slice(0, 8)}…` : 'sistema');
              const target = e.target_email ?? `id:${e.target_user_id.slice(0, 8)}…`;
              const mpPaymentId = (e.metadata as { mp_payment_id?: string } | null)?.mp_payment_id;
              return (
                <div key={e.id} className="cc-mod-row">
                  <div className="cc-mod-body">
                    <div className="cc-mod-name">
                      <span className={`cc-mod-badge ${meta.cls}`}>{meta.label}</span>{' '}
                      <span style={{ color: 'var(--cc-txt-3)' }}>· {target}</span>
                    </div>
                    <div className="cc-mod-sub">
                      {date} · actor: <b style={{ color: 'var(--cc-txt-3)' }}>{actor}</b>
                      {mpPaymentId && (
                        <>
                          {' · '}MP #{mpPaymentId}
                        </>
                      )}
                    </div>
                    <div
                      className="cc-mod-sub"
                      style={{
                        marginTop: 4,
                        color: 'var(--cc-txt-2)',
                      }}
                    >
                      {formatDiff(e.before, e.after)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p
          style={{
            fontSize: 11.5,
            color: 'var(--cc-txt-4)',
            fontFamily: 'var(--cc-mono), monospace',
            marginTop: 10,
            paddingLeft: 4,
          }}
        >
          ▸ Solo los admins ven esto. Cuando el actor dice &laquo;sistema&raquo; es un cambio automático hecho por un pago.
        </p>
      </div>
    </div>
  );
}
