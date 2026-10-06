'use client';

// LANDING-SPEC §3.12 (mockup 44): below 768 px a fixed bottom bar with the
// trial button, shown once the hero's CTA has scrolled away and hidden while
// the pricing cards, the final CTA or the cookie banner are on screen. The
// page leaves room for it (pub-sticky-room) so it never covers the footer.

import { useEffect, useState } from 'react';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';

export function StickyCta({ href, label, note }: { href: Route; label: string; note: string | null }) {
  const [heroGone, setHeroGone] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [cookies, setCookies] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const hero = document.querySelector('.pub-hero2__cta') ?? document.getElementById('hero');
    const blockers = ['precios', 'final']
      .map((id) => document.getElementById(id))
      .filter((x): x is HTMLElement => !!x);
    const seen = new Set<Element>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === hero) setHeroGone(!e.isIntersecting && e.boundingClientRect.top < 0);
        else if (e.isIntersecting) seen.add(e.target);
        else seen.delete(e.target);
      }
      setBlocked(seen.size > 0);
    });
    if (hero) io.observe(hero);
    blockers.forEach((b) => io.observe(b));
    const check = () =>
      setCookies(getComputedStyle(document.documentElement).getPropertyValue('--consent-h').trim() !== '');
    check();
    const mo = new MutationObserver(check);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  const show = heroGone && !blocked && !cookies;
  useEffect(() => {
    if (show)
      window.dispatchEvent(new CustomEvent('chalyb:landing', { detail: { event: 'landing_sticky_shown' } }));
  }, [show]);

  return (
    <div className="pub-sticky" data-show={show} aria-hidden={!show}>
      <Link href={href} className="ch-btn ch-btn--primary" tabIndex={show ? 0 : -1} data-cta="sticky_trial">
        {label}
      </Link>
      {note && <small>{note}</small>}
    </div>
  );
}
