// A row of pills under a Clips tab (Mis clips: Clips | Videos; Ajustes
// sections). Plain links; the current one is marked.

import type { Route } from 'next';
import { Link } from '@/i18n/routing';

export function ClipsSubnav({
  items,
  current,
  label,
}: {
  items: { href: string; label: string }[];
  current: string;
  label: string;
}) {
  return (
    <nav className="ch-ce-subnav" aria-label={label}>
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href as Route}
          aria-current={i.href === current ? 'page' : undefined}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
