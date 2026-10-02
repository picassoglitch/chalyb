import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { isAdminRole } from '@/lib/billing/tiers';
import {
  listAdminThreads,
  listThreadMessages,
  listPartnerInquiries,
  type ThreadSummary,
  type PartnerInquiryRow,
} from '@/lib/messages/messages-data';
import {
  markThreadReadAsAdmin,
  markInquiryReadAsAdmin,
} from '@/lib/messages/messages-actions';
import { MessageThread } from '@/components/messages/message-thread';
import { AdminReplyComposer } from '@/components/messages/admin-reply-composer';
import { InquiryActions } from '@/components/messages/inquiry-actions';

export const metadata = { title: 'Mensajes — Administración' };

// Admin inbox.
//
// LAYOUT:
//   left rail (≈ 340px) — list of subscriber threads + partner_inquiries
//     blended together, ordered by recency. Unread items rendered bold + dot.
//     Each item is a link to the same page with ?t=<userId> or ?i=<inquiryId>.
//   main pane — either:
//     (a) selected thread → MessageThread + AdminReplyComposer
//     (b) selected inquiry → name/email/message + actions (mark read, copy email)
//     (c) nothing selected → empty-state hint
//
// SELECTION via search params so the URL is shareable + the back button works.
// We auto-mark the selected item as read on render (best-effort, swallowed
// errors) so the admin doesn't need a separate "mark read" action.

interface InboxItem {
  kind: 'thread' | 'inquiry';
  id: string; // thread_user_id for threads, inquiry.id for inquiries
  primary: string; // top line (name or email)
  secondary: string; // preview of message body
  ts: string; // ISO sort key
  unread: boolean;
  badge?: string; // small chip text (e.g. "Lead Partner", tier)
}

function buildInboxList(
  threads: ThreadSummary[],
  inquiries: PartnerInquiryRow[],
): InboxItem[] {
  const items: InboxItem[] = [];
  for (const t of threads) {
    items.push({
      kind: 'thread',
      id: t.threadUserId,
      primary: t.userFullName ?? t.userEmail ?? '(sin nombre)',
      secondary: t.lastMessage.slice(0, 80),
      ts: t.lastMessageAt,
      unread: t.unreadForAdmin > 0,
      badge: t.userTier,
    });
  }
  for (const i of inquiries) {
    items.push({
      kind: 'inquiry',
      id: i.id,
      primary: i.name,
      secondary: i.message.slice(0, 80),
      ts: i.created_at,
      unread: i.read_at_admin === null,
      badge:
        i.pane === 'partner'
          ? 'Prospecto Partner'
          : i.pane === 'earn'
            ? 'Prospecto Earn'
            : 'Prospecto',
    });
  }
  // Unread items always come first; within each group sort by ts desc.
  items.sort((a, b) => {
    if (a.unread !== b.unread) return a.unread ? -1 : 1;
    return b.ts.localeCompare(a.ts);
  });
  return items;
}

export default async function AdminMessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ t?: string; i?: string }>;
}) {
  const { locale } = await params;
  const { t: threadUserId, i: inquiryId } = await searchParams;
  setRequestLocale(locale);

  const session = await getSessionUser();
  if (!session) redirect('/sign-in?next=/dashboard/messages');
  if (!isAdminRole(session.role)) redirect('/app');

  const [threads, inquiries] = await Promise.all([
    listAdminThreads(),
    listPartnerInquiries(),
  ]);

  // Auto-mark the selected item as read (the act of opening it = reading it).
  if (threadUserId) {
    await markThreadReadAsAdmin(threadUserId);
  } else if (inquiryId) {
    await markInquiryReadAsAdmin(inquiryId);
  }

  const items = buildInboxList(threads, inquiries);
  const selectedThread = threadUserId
    ? threads.find((t) => t.threadUserId === threadUserId)
    : null;
  const selectedInquiry = inquiryId
    ? inquiries.find((i) => i.id === inquiryId)
    : null;
  const threadMessages = selectedThread
    ? await listThreadMessages(selectedThread.threadUserId)
    : [];

  return (
    <div
      className="cc-scroll"
      style={{ padding: '0 0 40px' }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '340px 1fr',
          gap: 18,
          alignItems: 'start',
        }}
      >
        {/* ── Left rail: inbox list ────────────────────────────────────── */}
        <div
          style={{
            border: '1px solid var(--cc-line)',
            borderRadius: 'var(--cc-r-l)',
            background: 'var(--cc-panel)',
            overflow: 'hidden',
            maxHeight: 'calc(100dvh - 160px)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid var(--cc-line)',
              background: 'var(--cc-bg-1)',
              fontFamily: 'var(--cc-mono), monospace',
              fontSize: 10.5,
              letterSpacing: '0.13em',
              color: 'var(--cc-txt-4)',
              textTransform: 'uppercase',
            }}
          >
            Mensajes · {items.length} mensaje{items.length === 1 ? '' : 's'}
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {items.length === 0 ? (
              <div
                style={{
                  padding: 30,
                  textAlign: 'center',
                  color: 'var(--cc-txt-4)',
                  fontSize: 12.5,
                }}
              >
                Todavía no tienes mensajes. Aquí verás lo que te escriben tus
                suscriptores y las personas que te contactan desde tu página.
              </div>
            ) : (
              items.map((it) => {
                const isActive =
                  (it.kind === 'thread' && it.id === threadUserId) ||
                  (it.kind === 'inquiry' && it.id === inquiryId);
                const href = (
                  it.kind === 'thread'
                    ? `/dashboard/messages?t=${it.id}`
                    : `/dashboard/messages?i=${it.id}`
                ) as Route;
                return (
                  <Link
                    key={it.kind + ':' + it.id}
                    href={href}
                    style={{
                      display: 'block',
                      padding: '12px 14px',
                      borderBottom: '1px solid var(--cc-line-soft)',
                      background: isActive ? 'var(--cc-hover)' : 'transparent',
                      borderLeft: isActive
                        ? '3px solid var(--cc-green)'
                        : '3px solid transparent',
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      {it.unread && (
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            background: 'var(--cc-green)',
                            boxShadow: '0 0 6px var(--cc-green)',
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: it.unread ? 600 : 500,
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: 'var(--cc-txt)',
                        }}
                      >
                        {it.primary}
                      </span>
                      {it.badge && (
                        <span
                          style={{
                            fontFamily: 'var(--cc-mono), monospace',
                            fontSize: 9,
                            letterSpacing: '0.1em',
                            color:
                              it.kind === 'inquiry'
                                ? 'var(--cc-amber)'
                                : 'var(--cc-txt-4)',
                            background:
                              it.kind === 'inquiry'
                                ? 'var(--cc-amber-g)'
                                : 'var(--cc-bg-3)',
                            border:
                              it.kind === 'inquiry'
                                ? '1px solid rgba(245,177,61,.3)'
                                : '1px solid var(--cc-line-2)',
                            padding: '2px 6px',
                            borderRadius: 4,
                            textTransform: 'uppercase',
                          }}
                        >
                          {it.badge}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--cc-txt-3)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {it.secondary || '(mensaje vacío)'}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right pane: detail ────────────────────────────────────── */}
        <div style={{ minWidth: 0 }}>
          {selectedThread ? (
            <ThreadDetail
              summary={selectedThread}
              messages={threadMessages}
            />
          ) : selectedInquiry ? (
            <InquiryDetail inquiry={selectedInquiry} />
          ) : (
            <EmptyDetail />
          )}
        </div>
      </div>
    </div>
  );
}

function ThreadDetail({
  summary,
  messages,
}: {
  summary: ThreadSummary;
  messages: Awaited<ReturnType<typeof listThreadMessages>>;
}) {
  return (
    <div>
      <div
        style={{
          padding: '14px 18px',
          border: '1px solid var(--cc-line)',
          background: 'var(--cc-panel-2)',
          borderRadius: 'var(--cc-r-l)',
          marginBottom: 14,
        }}
      >
        <h3 style={{ fontSize: 14, marginBottom: 2 }}>
          {summary.userFullName ?? summary.userEmail ?? '(sin nombre)'}
        </h3>
        <div
          style={{
            fontFamily: 'var(--cc-mono), monospace',
            fontSize: 11,
            color: 'var(--cc-txt-4)',
          }}
        >
          {summary.userEmail ?? '—'} · plan {summary.userTier}
        </div>
      </div>

      <MessageThread messages={messages} viewer="ADMIN" />

      <div style={{ marginTop: 14 }}>
        <AdminReplyComposer threadUserId={summary.threadUserId} />
      </div>
    </div>
  );
}

function InquiryDetail({ inquiry }: { inquiry: PartnerInquiryRow }) {
  const created = new Date(inquiry.created_at).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <div>
      <div
        style={{
          padding: '14px 18px',
          border: '1px solid var(--cc-line)',
          background: 'var(--cc-panel-2)',
          borderRadius: 'var(--cc-r-l)',
          marginBottom: 14,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 6,
          }}
        >
          <h3 style={{ fontSize: 14 }}>{inquiry.name}</h3>
          <span
            style={{
              fontFamily: 'var(--cc-mono), monospace',
              fontSize: 9,
              letterSpacing: '0.12em',
              color: 'var(--cc-amber)',
              background: 'var(--cc-amber-g)',
              border: '1px solid rgba(245,177,61,.3)',
              padding: '2px 7px',
              borderRadius: 4,
              textTransform: 'uppercase',
            }}
          >
            Prospecto {inquiry.pane}
          </span>
        </div>
        <div
          style={{
            fontFamily: 'var(--cc-mono), monospace',
            fontSize: 11,
            color: 'var(--cc-txt-4)',
          }}
        >
          {inquiry.email} · {created}
        </div>
      </div>

      <div
        style={{
          padding: '16px 20px',
          border: '1px solid var(--cc-line)',
          background: 'var(--cc-panel)',
          borderRadius: 'var(--cc-r-l)',
          fontSize: 13.5,
          lineHeight: 1.55,
          color: 'var(--cc-txt)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          marginBottom: 16,
        }}
      >
        {inquiry.message}
      </div>

      <InquiryActions email={inquiry.email} inquiryId={inquiry.id} />
    </div>
  );
}

function EmptyDetail() {
  return (
    <div
      style={{
        padding: '60px 30px',
        textAlign: 'center',
        border: '1px dashed var(--cc-line)',
        background: 'var(--cc-bg-1)',
        borderRadius: 'var(--cc-r-l)',
        color: 'var(--cc-txt-3)',
      }}
    >
      <div style={{ fontSize: 30, marginBottom: 12 }}>✉</div>
      <p style={{ fontSize: 13, marginBottom: 6 }}>
        Elige una conversación o un contacto de la lista.
      </p>
      <small style={{ fontSize: 11.5, color: 'var(--cc-txt-4)' }}>
        Los mensajes nuevos llegan solos: cuando un suscriptor te escribe desde{' '}
        <code>/app/messages</code> o cuando alguien llena el formulario de contacto
        de tu página.
      </small>
    </div>
  );
}
