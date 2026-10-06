'use client';

// "Confirma · paso 2 de 2" (P5): every destructive or money-moving action in
// the owner panel goes through this sheet. [No, volver] closes it; the
// action runs only from [Sí, …].

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Sheet } from '@/components/ui/sheet';

export function ConfirmStep({
  open,
  title,
  body,
  yesLabel,
  noLabel,
  danger,
  onYes,
  onNo,
  children,
  yesDisabled,
}: {
  open: boolean;
  title: string;
  body: string;
  yesLabel: string;
  noLabel: string;
  danger?: boolean;
  onYes: () => Promise<void> | void;
  onNo: () => void;
  /** Extra fields between the question and the buttons (e.g. a reason). */
  children?: ReactNode;
  yesDisabled?: boolean;
}) {
  const t = useTranslations('admin.people.confirm');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onNo} title={title} closeLabel={noLabel}>
      <p className="ch-eyebrow" style={{ marginBottom: 8 }}>
        {t('step')}
      </p>
      <p style={{ fontSize: 17, marginBottom: 18 }}>{body}</p>
      {children}
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
        <button type="button" className="ch-btn ch-btn--secondary" onClick={onNo} disabled={busy}>
          {noLabel}
        </button>
        <button
          type="button"
          className={`ch-btn ${danger ? 'ch-btn--danger' : 'ch-btn--primary'}`}
          disabled={busy || yesDisabled}
          onClick={async () => {
            setBusy(true);
            try {
              await onYes();
            } finally {
              setBusy(false);
            }
          }}
        >
          {yesLabel}
        </button>
      </div>
    </Sheet>
  );
}
