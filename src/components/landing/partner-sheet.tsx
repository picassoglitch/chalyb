'use client';

// "Proponer mi idea" opens the same form that used to sit on the page, in a
// sheet (modal on desktop, bottom sheet on a phone). Focus returns to the
// button on close (the shared Sheet traps it and closes on Esc).

import { useRef, useState } from 'react';
import { Sheet } from '@/components/ui/sheet';
import { IdeaForm } from '@/components/public/idea-form';

export function PartnerSheet({ label, title, close }: { label: string; title: string; close: string }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={button}
        type="button"
        className="ch-btn ch-btn--secondary"
        onClick={() => {
          setOpen(true);
          window.dispatchEvent(new CustomEvent('chalyb:landing', { detail: { event: 'landing_partner_open' } }));
        }}
        data-cta="partner_open"
      >
        {label}
      </button>
      <Sheet
        open={open}
        onClose={() => {
          setOpen(false);
          button.current?.focus();
        }}
        title={title}
        closeLabel={close}
      >
        <IdeaForm />
      </Sheet>
    </>
  );
}
