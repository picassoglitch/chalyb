'use client';

// The public nav's menu below 1024 px (LANDING-SPEC §3.1, §8): a sheet that
// drops down with the links, "Iniciar sesión" and the trial button. Esc, ✕
// and any link close it; focus is trapped while open and returns to the
// hamburger.

import { useEffect, useRef, useState } from 'react';
import type { Route } from 'next';
import { Menu, X } from 'lucide-react';
import { Link } from '@/i18n/routing';

interface Item {
  key: string;
  href: string;
  label: string;
}

export function MobileMenu({
  links,
  login,
  cta,
  labels,
}: {
  links: Item[];
  login: { href: string; label: string };
  cta: { href: string; label: string };
  labels: { open: string; close: string; aria: string };
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const el = sheet.current;
    const focusables = () =>
      Array.from(el?.querySelectorAll<HTMLElement>('a[href], button') ?? []);
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
      if (e.key !== 'Tab') return;
      const f = focusables();
      if (!f.length) return;
      const first = f[0]!;
      const last = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    window.dispatchEvent(new CustomEvent('chalyb:landing', { detail: { event: 'landing_menu_open' } }));
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        className="pub-nav__burger"
        aria-label={labels.open}
        aria-expanded={open}
        aria-controls="pub-menu"
        onClick={() => setOpen(true)}
      >
        <Menu aria-hidden="true" />
      </button>
      {open && (
        <div className="pub-menu__scrim" onClick={close}>
          <div
            id="pub-menu"
            ref={sheet}
            className="pub-menu"
            role="dialog"
            aria-modal="true"
            aria-label={labels.aria}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="pub-menu__x" aria-label={labels.close} onClick={close}>
              <X aria-hidden="true" />
            </button>
            <nav aria-label={labels.aria}>
              {links.map((l) => (
                <Link key={l.key} href={l.href as Route} onClick={() => setOpen(false)} data-nav={l.key}>
                  {l.label}
                </Link>
              ))}
              <Link href={login.href as Route} onClick={() => setOpen(false)} data-signin="menu">
                {login.label}
              </Link>
            </nav>
            <Link
              href={cta.href as Route}
              className="ch-btn ch-btn--primary ch-btn--xl"
              onClick={() => setOpen(false)}
              data-cta="menu_trial"
            >
              {cta.label}
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
