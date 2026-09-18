// /dashboard/activity — "Actividad". Notifications and the audit log, and
// nothing else.
//
// Both used to be top-level nav items in different groups (Notifications
// under "Infra", Audit log under "Organización"), which is two places to
// look for the same question: what happened, and did anyone need to know.
// This is the landing surface for both; each still has its full view a
// click away for the long lists and the diffs.

import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { listNotifications, timeAgo, type NotificationRow } from '@/lib/data/ops';
import { markAllNotificationsRead } from '@/lib/notifications/actions';

export const metadata = { title: 'Actividad' };

const SEVERITY_BADGE: Record<NotificationRow['severity'], { label: string; cls: string }> = {
  critical: { label: 'CRÍTICO', cls: 'r' },
  warning: { label: 'AVISO', cls: 'am' },
  info: { label: 'INFO', cls: 'gr' },
};

// The audit log stores machine action names. A default view shows what they
// mean; the raw name stays available in the full log.
const ACTION_LABEL: Record<string, { label: string; cls: string }> = {
  'tier.change': { label: 'Plan cambiado por un admin', cls: 'gr' },
  'tier.payment': { label: 'Plan activado con el pago', cls: 'gr' },
  'tier.downgrade': { label: 'Bajada de plan', cls: 'am' },
  'role.change': { label: 'Rol cambiado', cls: 'pu' },
  'team.invite': { label: 'Invitación enviada', cls: 'pu' },
  'selected_bot.change': { label: 'Engine en vivo cambiado', cls: 'cy' },
  'partner.engine_assign': { label: 'Engine asignado a un socio', cls: 'pu' },
  'tokens.grant': { label: 'Tokens otorgados', cls: 'cy' },
  'tokens.revoke': { label: 'Tokens retirados', cls: 'am' },
};

interface AuditRow {
  id: string;
  action: string;
  actor_id: string | null;
  actor_email: string | null;
  target_user_id: string;
  target_email: string | null;
  created_at: string;
}

export default async function ActivityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSessionUser();
  if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN')) {
    redirect('/app');
  }

  const supabase = await createClient();
  const [notifications, auditRes] = await Promise.all([
    listNotifications().catch((err) => {
      console.error('[/dashboard/activity] notifications failed:', err);
      return null;
    }),
    supabase
      .from('audit_events')
      .select('id, action, actor_id, actor_email, target_user_id, target_email, created_at')
      .order('created_at', { ascending: false })
      .limit(12),
  ]);

  const unread = (notifications ?? []).filter((n) => !n.read_at);
  const auditEvents = (auditRes.data ?? []) as AuditRow[];
  if (auditRes.error) {
    console.error('[/dashboard/activity] audit query failed:', auditRes.error.message);
  }

  return (
    <div className="cc-scroll">
      {/* ── Notifications ─────────────────────────────────────────────── */}
      <div className="cc-mod-section">
        <div
          className="cc-mod-sl"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span>Sin leer {notifications === null ? '' : `(${unread.length})`}</span>
          {unread.length > 0 && (
            <form
              action={async () => {
                'use server';
                await markAllNotificationsRead();
              }}
            >
              <button
                type="submit"
                className="cc-mod-badge gr"
                style={{ cursor: 'pointer', border: 'none' }}
              >
                Marcar todas como leídas
              </button>
            </form>
          )}
        </div>
        {notifications === null ? (
          <div className="cc-mod-empty-note">
            Sin datos — no pudimos leer las notificaciones.
            <br />
            <small>Es una falla de lectura, no la ausencia de alertas.</small>
          </div>
        ) : unread.length === 0 ? (
          <div className="cc-mod-empty-note">
            Estás al día. No hay notificaciones pendientes.
            <br />
            <small>Los cobros de Mercado Pago y los engines conectados avisan aquí.</small>
          </div>
        ) : (
          <div className="cc-mod-list">
            {unread.slice(0, 10).map((n) => {
              const badge = SEVERITY_BADGE[n.severity] ?? SEVERITY_BADGE.info;
              return (
                <div key={n.id} className="cc-mod-row">
                  <div className="cc-mod-ic">🔔</div>
                  <div className="cc-mod-body">
                    <div className="cc-mod-name">
                      <span className={`cc-mod-badge ${badge.cls}`}>{badge.label}</span> {n.title}
                    </div>
                    <div className="cc-mod-sub">
                      {n.body ?? '—'}
                      {n.href && (
                        <>
                          {' · '}
                          <a href={n.href} style={{ color: 'var(--cc-cyan)' }}>
                            Ver detalle
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="cc-mod-right">
                    <b title={new Date(n.created_at).toLocaleString('es-MX')}>
                      {timeAgo(n.created_at)}
                    </b>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p style={{ marginTop: 10, paddingLeft: 4, fontSize: 12.5 }}>
          <Link
            href={'/dashboard/notifications' as Route}
            style={{ color: 'var(--cc-green)', textDecoration: 'underline' }}
          >
            Ver todas las notificaciones →
          </Link>
        </p>
      </div>

      {/* ── Audit ─────────────────────────────────────────────────────── */}
      <div className="cc-mod-section">
        <div className="cc-mod-sl">Últimos movimientos</div>
        {auditEvents.length === 0 ? (
          <div className="cc-mod-empty-note">
            Todavía no hay movimientos registrados.
            <br />
            <small>Cada cambio de plan, de rol o de tokens aparece aquí.</small>
          </div>
        ) : (
          <div className="cc-mod-list">
            {auditEvents.map((e) => {
              const meta = ACTION_LABEL[e.action] ?? { label: e.action, cls: '' };
              const date = new Date(e.created_at).toLocaleString(
                locale === 'es' ? 'es-MX' : 'en-US',
                { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
              );
              // A raw uuid is debug output. The full log shows the ids.
              const actor = e.actor_email ?? (e.actor_id ? 'otro admin' : 'sistema');
              const target = e.target_email ?? 'un usuario';
              return (
                <div key={e.id} className="cc-mod-row">
                  <div className="cc-mod-body">
                    <div className="cc-mod-name">
                      <span className={`cc-mod-badge ${meta.cls}`}>{meta.label}</span>{' '}
                      <span style={{ color: 'var(--cc-txt-3)' }}>· {target}</span>
                    </div>
                    <div className="cc-mod-sub">
                      {date} · por <b style={{ color: 'var(--cc-txt-3)' }}>{actor}</b>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p style={{ marginTop: 10, paddingLeft: 4, fontSize: 12.5 }}>
          <Link
            href={'/dashboard/audit' as Route}
            style={{ color: 'var(--cc-green)', textDecoration: 'underline' }}
          >
            Abrir el registro completo · con los cambios campo por campo →
          </Link>
        </p>
      </div>
    </div>
  );
}
