'use client';

// Modal sheet (radius 28): traps focus, closes on Esc and on the scrim, and
// returns focus to whatever opened it (rebuild prompt §6.3).

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Sheet({
  open,
  onClose,
  title,
  closeLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusables = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    focusables()[0]?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'grid',
        placeItems: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(20,20,30,.38)' }}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        style={{
          position: 'relative',
          background: '#fff',
          borderRadius: 28,
          boxShadow: '0 30px 80px rgba(10,10,30,.30)',
          padding: 34,
          width: '100%',
          maxWidth: 560,
          maxHeight: '90dvh',
          overflow: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <h2 id="sheet-title" className="ch-h2">
            {title}
          </h2>
          <button type="button" className="ch-close" aria-label={closeLabel} onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
