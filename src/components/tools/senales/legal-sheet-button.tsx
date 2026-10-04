'use client';

// "Leer otra vez": the risk notice, word for word, in a sheet (§0.1).

import { useState } from 'react';
import { Sheet } from '@/components/ui/sheet';
import { Markup } from '@/components/ui/markup';

export function LegalSheetButton({
  label,
  title,
  legal,
  closeLabel,
}: {
  label: string;
  title: string;
  legal: string;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="ch-lnk ch-linkbtn" onClick={() => setOpen(true)}>
        {label}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title} closeLabel={closeLabel}>
        <p>
          <Markup text={legal} />
        </p>
      </Sheet>
    </>
  );
}
