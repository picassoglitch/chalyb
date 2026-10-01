'use client';

// SCR-11: a sticky bottom "Prueba Pro gratis 1 mes" on phones, shown once the
// hero (and its own CTA) has scrolled away. Hidden on desktop via CSS.

import { useEffect, useState } from 'react';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';

export function StickyCta({ href, label }: { href: Route; label: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const hero = document.getElementById('hero');
    if (!hero || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setShow(!entry!.isIntersecting), {
      threshold: 0,
    });
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  return (
    <div className="pub-sticky" data-show={show} aria-hidden={!show}>
      <Link
        href={href}
        className="ch-btn ch-btn--primary"
        tabIndex={show ? 0 : -1}
        data-cta="trial-sticky"
      >
        {label}
      </Link>
    </div>
  );
}
