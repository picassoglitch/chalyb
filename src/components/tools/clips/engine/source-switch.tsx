'use client';
// The "Hacer clips" source picker and the picked source's panel. Switching
// sources only changes ?fuente=, so Next keeps the old panel on screen until
// the new one is ready; here the click marks the new pill at once and the
// panel turns into a shimmer while the engine answers, so the old source's
// form never sits there looking current. Plain links underneath (ctrl-click,
// no JavaScript and the back button work as before).

import type { Route } from 'next';
import { useState, useTransition, type MouseEvent, type ReactNode } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { Skeleton } from '@/components/ui/primitives';
import { isPlainClick } from '@/components/ui/optimistic-nav';

export function SourceSwitch({
  label,
  loadingLabel,
  current,
  items,
  children,
}: {
  label: string;
  loadingLabel: string;
  current: string;
  items: { href: string; label: string }[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [picked, setPicked] = useState<{ href: string; from: string } | null>(null);
  const shown = picked && picked.from === current ? picked.href : current;
  const go = (href: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e) || href === current) return;
    e.preventDefault();
    setPicked({ href, from: current });
    startTransition(() => router.push(href as Route));
  };
  return (
    <>
      <div className="ch-ce-picker">
        <nav className="ch-ce-subnav" aria-label={label}>
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href as Route}
              aria-current={i.href === shown ? 'page' : undefined}
              onClick={go(i.href)}
            >
              {i.label}
            </Link>
          ))}
        </nav>
      </div>
      {pending ? (
        <div
          className="ch-loading ch-loading--col"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <span className="ch-sr">{loadingLabel}</span>
          <Skeleton height={44} style={{ width: '60%', margin: '0 auto' }} />
          <Skeleton height={24} style={{ width: '80%', margin: '0 auto' }} />
          <Skeleton height={180} />
        </div>
      ) : (
        children
      )}
    </>
  );
}
