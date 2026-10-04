'use client';

// Señales' legal strip (TOOLS-SPEC §3, §5.2; BUILD-SPEC §7.2): always
// visible on Señales, its detail and Historial. "Leer aviso completo" opens
// the notice word for word in a sheet inside the app (§0.1), never a tab.

import { useState } from 'react';
import { Info } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Markup } from '@/components/ui/markup';

export function DisclaimerFooter({
  text,
  readLabel,
  sheetTitle,
  legal,
  closeLabel,
}: {
  text: string;
  readLabel: string;
  sheetTitle: string;
  legal: string;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <footer className="ch-disclaimer" data-testid="signals-disclaimer">
      <Info aria-hidden="true" />
      <p>
        <Markup text={text} />
      </p>
      <button type="button" className="ch-lnk" onClick={() => setOpen(true)}>
        {readLabel}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={sheetTitle} closeLabel={closeLabel}>
        <p>
          <Markup text={legal} />
        </p>
      </Sheet>
    </footer>
  );
}
