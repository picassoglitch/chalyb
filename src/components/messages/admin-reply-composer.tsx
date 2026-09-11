'use client';

// Thin wrapper around MessageComposer that binds the server action with
// the target thread id. Lives as its own client component so the page
// (a server component) can hand a serializable prop instead of a closure.

import { MessageComposer } from './message-composer';
import { sendReplyFromAdmin } from '@/lib/messages/messages-actions';

export function AdminReplyComposer({ threadUserId }: { threadUserId: string }) {
  return (
    <MessageComposer
      send={(body) => sendReplyFromAdmin(threadUserId, body)}
      placeholder="Responde como equipo Chalyb. La persona suscrita lo verá en /app/messages."
      buttonLabel="Responder"
    />
  );
}
