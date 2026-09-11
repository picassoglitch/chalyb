'use client';

// Quick actions for a partner_inquiries row in the admin inbox. Today:
//   - Copy the sender's email (so the admin can drop into Gmail/Resend).
//   - Mark as read (idempotent — auto-mark also runs on page load, this is
//     the manual fallback for the user who wants to un-read something).
// Future: "promover a partner" button → opens a confirm + creates the
// auth.users row + sets tier=PARTNER + links promoted_user_id.

import { useTransition } from 'react';
import { useWorkspace } from '@/lib/workspace/store';
import { markInquiryReadAsAdmin } from '@/lib/messages/messages-actions';

export function InquiryActions({
  email,
  inquiryId,
}: {
  email: string;
  inquiryId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const showToast = useWorkspace((s) => s.showToast);

  function copyEmail() {
    void navigator.clipboard.writeText(email).then(
      () => showToast('Email copiado al portapapeles.'),
      () => showToast('<b>Error</b> · no se pudo copiar (permisos del navegador).'),
    );
  }

  function markRead() {
    startTransition(async () => {
      const res = await markInquiryReadAsAdmin(inquiryId);
      if (!res.ok) {
        showToast(`<b>Error</b> · ${res.error ?? 'no se pudo marcar'}`);
        return;
      }
      showToast('Marcado como leído.');
    });
  }

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={copyEmail}
        style={{
          padding: '8px 14px',
          borderRadius: 'var(--cc-r)',
          border: '1px solid var(--cc-line-2)',
          background: 'var(--cc-bg-3)',
          color: 'var(--cc-txt)',
          fontFamily: 'inherit',
          fontSize: 12.5,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        ⎘ Copiar email
      </button>
      <button
        type="button"
        onClick={markRead}
        disabled={isPending}
        style={{
          padding: '8px 14px',
          borderRadius: 'var(--cc-r)',
          border: '1px solid var(--cc-line-2)',
          background: 'transparent',
          color: isPending ? 'var(--cc-txt-4)' : 'var(--cc-txt-2)',
          fontFamily: 'inherit',
          fontSize: 12.5,
          fontWeight: 500,
          cursor: isPending ? 'default' : 'pointer',
        }}
      >
        {isPending ? 'Marcando…' : '✓ Marcar leído'}
      </button>
    </div>
  );
}
