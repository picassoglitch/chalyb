'use client';
// A form's submit button that shows the click landed: while the form's
// server action (or GET) is running it is disabled, marked busy and shows a
// small spinner next to the same label, so a slow engine never looks like a
// dead button and a double click can't send the form twice.

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

export function SubmitButton({ className, children }: { className: string; children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending && <span className="ch-btnspin" aria-hidden="true" />}
      {children}
    </button>
  );
}
