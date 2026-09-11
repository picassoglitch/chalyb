// Server-rendered thread of message bubbles. No client interactivity here —
// the composer is a separate client component below. Keeping read-side
// rendering on the server lets RSC stream the history without a flash.

import type { MessageRow } from '@/lib/messages/messages-data';

interface Props {
  messages: MessageRow[];
  /** Which side is the viewer? Determines bubble alignment + color. */
  viewer: 'USER' | 'ADMIN';
  /** Empty-state copy when the thread has zero messages. */
  emptyMessage?: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MessageThread({ messages, viewer, emptyMessage }: Props) {
  if (messages.length === 0) {
    return (
      <div
        style={{
          padding: '40px 20px',
          textAlign: 'center',
          color: 'var(--cc-txt-4)',
          fontSize: 13,
          border: '1px dashed var(--cc-line)',
          borderRadius: 'var(--cc-r-l)',
          background: 'var(--cc-bg-1)',
        }}
      >
        {emptyMessage ??
          'Aún no hay mensajes. Escribe abajo y empieza la conversación.'}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '4px 2px 20px',
      }}
    >
      {messages.map((m) => {
        const fromViewer = m.sender_role === viewer;
        // viewer bubble = right-aligned, green-ish; counterpart bubble =
        // left-aligned, panel-colored. Mirrors any modern chat UI.
        return (
          <div
            key={m.id}
            style={{
              display: 'flex',
              justifyContent: fromViewer ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '78%',
                padding: '10px 14px',
                borderRadius: fromViewer
                  ? '14px 14px 4px 14px'
                  : '14px 14px 14px 4px',
                background: fromViewer
                  ? 'var(--cc-green-g)'
                  : 'var(--cc-panel-2)',
                border: '1px solid',
                borderColor: fromViewer
                  ? 'rgba(158, 234, 58, 0.35)'
                  : 'var(--cc-line)',
                color: 'var(--cc-txt)',
                fontSize: 13.5,
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {m.body}
              <div
                style={{
                  marginTop: 6,
                  fontFamily: 'var(--cc-mono), monospace',
                  fontSize: 10.5,
                  color: 'var(--cc-txt-4)',
                  textAlign: fromViewer ? 'right' : 'left',
                }}
              >
                {m.sender_role === 'ADMIN' ? 'equipo Chalyb · ' : ''}
                {formatTime(m.created_at)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
