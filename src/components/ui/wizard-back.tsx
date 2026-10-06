'use client';

// "Atrás" (P3-1): the previous step when the wizard keeps its step in the
// URL (?paso=N); the page's own back target otherwise.

import type { Route } from 'next';
import { ChevronLeft } from 'lucide-react';
import { Link } from '@/i18n/routing';

export function WizardBack({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href as Route}
      className="ch-back"
      aria-label={label}
      onClick={(e) => {
        const paso = new URLSearchParams(window.location.search).get('paso');
        if (paso && paso !== '1' && window.history.length > 1) {
          e.preventDefault();
          window.history.back();
        }
      }}
    >
      <ChevronLeft aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}
