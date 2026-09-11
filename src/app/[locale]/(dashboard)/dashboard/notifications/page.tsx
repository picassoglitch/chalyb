import { setRequestLocale } from 'next-intl/server';
import { listNotifications, timeAgo, type NotificationRow } from '@/lib/data/ops';
import { markAllNotificationsRead } from '@/lib/notifications/actions';

export const metadata = { title: 'Notificaciones' };

const SEVERITY_BADGE: Record<NotificationRow['severity'], { label: string; cls: string }> = {
  critical: { label: 'CRÍTICO', cls: 'r' },
  warning: { label: 'AVISO', cls: 'am' },
  info: { label: 'INFO', cls: 'gr' },
};

function NotifRow({ n }: { n: NotificationRow }) {
  const badge = SEVERITY_BADGE[n.severity] ?? SEVERITY_BADGE.info;
  return (
    <div className="cc-mod-row">
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
        <b title={new Date(n.created_at).toLocaleString('es-MX')}>{timeAgo(n.created_at)}</b>
        <span>{n.source}</span>
      </div>
    </div>
  );
}

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const notifications = await listNotifications();
  const unread = notifications.filter((n) => !n.read_at);
  const read = notifications.filter((n) => n.read_at);

  return (
    <div className="cc-scroll">
      <div className="cc-mod-section">
        <div
          className="cc-mod-sl"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span>Sin leer ({unread.length})</span>
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
        {unread.length === 0 ? (
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
            Estás al día. No tienes notificaciones pendientes.
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
              Tus pagos de Mercado Pago y los sistemas conectados aparecen aquí al instante.
            </span>
          </div>
        ) : (
          <div className="cc-mod-list">
            {unread.map((n) => (
              <NotifRow key={n.id} n={n} />
            ))}
          </div>
        )}
      </div>

      {read.length > 0 && (
        <div className="cc-mod-section">
          <div className="cc-mod-sl">Anteriores ({read.length})</div>
          <div className="cc-mod-list">
            {read.map((n) => (
              <NotifRow key={n.id} n={n} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
