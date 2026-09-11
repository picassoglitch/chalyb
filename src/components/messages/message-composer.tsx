'use client';

// Composer used by both the subscriber /app/messages page and the admin
// /dashboard/messages reply panel. The action prop decides where the
// message goes — server actions handle persistence + revalidation.
//
// Behavior is intentionally minimal: textarea + send button + toast feedback.
// Enter sends (Shift+Enter newlines). Disable while pending. Reset on success.

import { useRef, useState, useTransition } from 'react';
import { useWorkspace } from '@/lib/workspace/store';

interface Props {
  /** Server action receiving the body. Returns ok/error so we can toast. */
  send: (body: string) => Promise<{ ok: boolean; error?: string }>;
  /** Placeholder copy — differs subscriber vs admin context. */
  placeholder?: string;
  /** Send-button label (default: "Enviar"). */
  buttonLabel?: string;
  /** Soft cap on chars. Server still enforces 4000 hard cap. */
  maxChars?: number;
}

export function MessageComposer({
  send,
  placeholder = 'Escribe tu mensaje aquí…',
  buttonLabel = 'Enviar',
  maxChars = 4000,
}: Props) {
  const [body, setBody] = useState('');
  const [isPending, startTransition] = useTransition();
  const taRef = useRef<HTMLTextAreaElement>(null);
  // useWorkspace's toast is shared across the dashboard. Both routes mount
  // workspace-shell or dashboard-shell which render the toast container.
  const showToast = useWorkspace((s) => s.showToast);

  function submit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await send(trimmed);
      if (!res.ok) {
        showToast(`<b>Error</b> · ${res.error ?? 'No pudimos enviar tu mensaje'}`);
        return;
      }
      setBody('');
      // Bring focus back so a quick second message is one keystroke away.
      taRef.current?.focus();
      showToast('Mensaje enviado.');
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter inserts a newline (standard chat affordance).
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  const overLimit = body.length > maxChars;
  const disabled = isPending || !body.trim() || overLimit;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '12px 14px',
        border: '1px solid var(--cc-line)',
        borderRadius: 'var(--cc-r-l)',
        background: 'var(--cc-panel)',
      }}
    >
      <textarea
        ref={taRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={3}
        style={{
          width: '100%',
          minHeight: 70,
          maxHeight: 220,
          padding: '8px 10px',
          fontFamily: 'inherit',
          fontSize: 13.5,
          lineHeight: 1.5,
          color: 'var(--cc-txt)',
          background: 'var(--cc-bg-1)',
          border: '1px solid var(--cc-line)',
          borderRadius: 'var(--cc-r)',
          resize: 'vertical',
          outline: 'none',
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          justifyContent: 'space-between',
        }}
      >
        <small
          style={{
            fontFamily: 'var(--cc-mono), monospace',
            fontSize: 10.5,
            color: overLimit ? 'var(--cc-red)' : 'var(--cc-txt-4)',
          }}
        >
          {body.length} / {maxChars}
          {overLimit && ' · excede el límite'}
        </small>
        <button
          type="button"
          onClick={submit}
          disabled={disabled}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--cc-r)',
            border: 'none',
            background: disabled ? 'var(--cc-bg-3)' : 'var(--cc-green)',
            color: disabled ? 'var(--cc-txt-4)' : '#070809',
            fontWeight: 600,
            fontSize: 12.5,
            cursor: disabled ? 'default' : 'pointer',
            fontFamily: 'inherit',
            transition: 'background 0.15s',
          }}
        >
          {isPending ? 'Enviando…' : buttonLabel}
        </button>
      </div>
    </div>
  );
}
