'use client';
// A row of pills under a Clips tab (Mis clips: Clips | Videos; Ajustes
// sections; the "Hacer clips" source picker). Plain links; the current one is
// marked, and a clicked one is marked right away while its screen loads.

import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import { useOptimisticPick } from '@/components/ui/optimistic-nav';

export function ClipsSubnav({
  items,
  current,
  label,
}: {
  items: { href: string; label: string }[];
  current: string;
  label: string;
}) {
  const { shown, pick } = useOptimisticPick(current);
  return (
    <nav className="ch-ce-subnav" aria-label={label}>
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href as Route}
          aria-current={i.href === shown ? 'page' : undefined}
          onClick={pick(i.href)}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
