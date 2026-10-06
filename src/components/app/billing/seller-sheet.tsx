'use client';

// The sheet half of "Quién vende": a button and a modal. The details are
// rendered on the server (seller.tsx) and passed in as children, so no
// configuration value is handed to client code.

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Sheet } from '@/components/ui/sheet';

export function SellerSheetButton({ label, children }: { label: string; children: ReactNode }) {
  const t = useTranslations('seller');
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="ch-lnk" onClick={() => setOpen(true)}>
        {label}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('title')} closeLabel={t('close')}>
        {children}
      </Sheet>
    </>
  );
}
