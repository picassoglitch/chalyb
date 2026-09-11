'use client';

import { useEffect } from 'react';

/**
 * GSAP/ScrollTrigger mobile choreography. 9 blocks, gated on:
 *   - matchMedia('(max-width: 820px)')
 *   - !matchMedia('(prefers-reduced-motion: reduce)')
 *
 * Defensive: forces hero text visible BEFORE any animation attaches.
 * Re-runs ScrollTrigger.refresh() on dependency change so the locale/path
 * remount re-measures the new DOM.
 */
export function MobileCinema({ refreshKey }: { refreshKey?: string }) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isMobile = window.matchMedia('(max-width: 820px)').matches;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!isMobile || reduce) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const gsapMod = await import('gsap');
      const stMod = await import('gsap/ScrollTrigger');
      if (cancelled) return;
      const gsap = gsapMod.gsap;
      const ScrollTrigger = stMod.ScrollTrigger;
      gsap.registerPlugin(ScrollTrigger);
      ScrollTrigger.config({ ignoreMobileResize: true });

      // DEFENSIVE: ensure hero text is visible BEFORE GSAP attaches.
      const heroTextSel = '.hero-kicker, .hero h1, .hero-lead, .hero-ctas, .trust-strip';
      document.querySelectorAll<HTMLElement>(heroTextSel).forEach((el) => {
        el.style.animation = 'none';
        el.style.opacity = '1';
        el.style.transform = 'none';
        el.style.filter = 'none';
      });
      document.querySelectorAll<HTMLElement>('.hero h1 .line span').forEach((el) => {
        el.style.transform = 'translateY(0)';
        el.style.opacity = '1';
        el.style.animation = 'none';
      });
      gsap.set(heroTextSel, { clearProps: 'all' });

      // 1. Hero entrance + scroll parallax
      const heroLayers = [
        { sel: '.hero-kicker', y: 24, blur: 4, dur: 0.9 },
        { sel: '.hero h1', y: 48, blur: 8, dur: 1.1 },
        { sel: '.hero-lead', y: 32, blur: 5, dur: 0.9 },
        { sel: '.hero-ctas', y: 24, blur: 3, dur: 0.85 },
        { sel: '.trust-strip', y: 20, blur: 2, dur: 0.85 },
      ];
      const tl = gsap.timeline({
        delay: 0.1,
        onComplete: () => {
          heroLayers.forEach((l) =>
            gsap.set(l.sel, { clearProps: 'filter,rotateX,z,transformPerspective' }),
          );
        },
      });
      heroLayers.forEach((layer, i) => {
        tl.fromTo(
          layer.sel,
          {
            y: layer.y,
            opacity: 0,
            filter: `blur(${layer.blur}px)`,
            transformPerspective: 1000,
            rotateX: 5,
            z: -30,
          },
          { y: 0, opacity: 1, filter: 'blur(0px)', rotateX: 0, z: 0, duration: layer.dur, ease: 'expo.out' },
          i * 0.1,
        );
      });
      gsap.to('.hero-kicker', {
        y: -40,
        opacity: 0.3,
        ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.5 },
      });
      gsap.to('.hero h1', {
        y: -80,
        opacity: 0.5,
        filter: 'blur(3px)',
        ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 },
      });
      gsap.to('.hero-lead', {
        y: -60,
        opacity: 0.4,
        ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.5 },
      });
      gsap.to('.hero-glow', {
        scale: 1.4,
        x: 120,
        y: -80,
        opacity: 0.6,
        ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.4 },
      });

      // 2. Doors
      gsap.fromTo(
        '.door',
        {
          y: 80,
          opacity: 0,
          rotateX: -22,
          z: -180,
          scale: 0.88,
          filter: 'blur(8px)',
          transformPerspective: 1200,
        },
        {
          y: 0,
          opacity: 1,
          rotateX: 0,
          z: 0,
          scale: 1,
          filter: 'blur(0px)',
          duration: 1.0,
          ease: 'expo.out',
          stagger: 0.13,
          scrollTrigger: { trigger: '.doors', start: 'top 85%', once: true },
        },
      );

      // 3. Tech stack scanline + chips
      const ts = document.querySelector<HTMLElement>('.trust-strip');
      if (ts) {
        const scan = document.createElement('div');
        scan.className = 'trust-scanline';
        ts.appendChild(scan);
        gsap.fromTo(
          ts.querySelectorAll('.ts-chip'),
          { opacity: 0, y: 14, scale: 0.92, filter: 'blur(4px)' },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            filter: 'blur(0px)',
            duration: 0.55,
            ease: 'power2.out',
            stagger: 0.06,
            scrollTrigger: { trigger: ts, start: 'top 88%', once: true },
          },
        );
        gsap.fromTo(
          scan,
          { left: '-60px', opacity: 0.8 },
          {
            left: '100%',
            opacity: 0,
            duration: 1.1,
            ease: 'power2.inOut',
            scrollTrigger: { trigger: ts, start: 'top 88%', once: true },
          },
        );
      }

      // 4. Cards
      const cardGroups = [
        { sel: '.service-row', x: -30, ry: -8 },
        { sel: '.process-step', y: 40, rx: -14 },
        { sel: '.how-step', y: 50, rx: -16 },
        { sel: '.proof-card', y: 60, rx: -12 },
        { sel: '.price-card', y: 60, rx: -12 },
      ];
      cardGroups.forEach((g) => {
        const els = document.querySelectorAll<HTMLElement>(g.sel);
        if (!els.length) return;
        els.forEach((el) => {
          gsap.fromTo(
            el,
            {
              opacity: 0,
              x: g.x || 0,
              y: g.y || 0,
              rotateX: g.rx || 0,
              rotateY: g.ry || 0,
              z: -100,
              scale: 0.94,
              filter: 'blur(6px)',
              transformPerspective: 1400,
            },
            {
              opacity: 1,
              x: 0,
              y: 0,
              rotateX: 0,
              rotateY: 0,
              z: 0,
              scale: 1,
              filter: 'blur(0px)',
              duration: 0.9,
              ease: 'expo.out',
              scrollTrigger: { trigger: el, start: 'top 88%', once: true },
            },
          );
        });
      });

      // 5. Section auras
      const auraSections = [
        { sel: '#client-world', color: 'rgba(61,245,224,0.18)' },
        { sel: '#partner-world', color: 'rgba(122,92,255,0.20)' },
        { sel: '#earn-world', color: 'rgba(198,242,78,0.16)' },
      ];
      auraSections.forEach((s) => {
        const sec = document.querySelector<HTMLElement>(s.sel);
        if (!sec) return;
        if (getComputedStyle(sec).position === 'static') sec.style.position = 'relative';
        const aura = document.createElement('div');
        aura.className = 'section-aura';
        aura.style.setProperty('--aura-c', s.color);
        sec.insertBefore(aura, sec.firstChild);
        gsap.to(aura, {
          opacity: 1,
          ease: 'none',
          scrollTrigger: { trigger: sec, start: 'top 80%', end: 'top 30%', scrub: 0.6 },
        });
        gsap.to(aura, {
          opacity: 0,
          ease: 'none',
          scrollTrigger: { trigger: sec, start: 'bottom 60%', end: 'bottom top', scrub: 0.6 },
        });
      });

      // 6. Dashboard mock
      const dashMock = document.querySelector<HTMLElement>('.dashboard-mock');
      if (dashMock) {
        gsap.fromTo(
          dashMock,
          { scale: 0.86, opacity: 0, y: 80, rotateX: -12, transformPerspective: 1400 },
          {
            scale: 1,
            opacity: 1,
            y: 0,
            rotateX: 0,
            duration: 1.1,
            ease: 'expo.out',
            scrollTrigger: { trigger: dashMock, start: 'top 85%', once: true },
          },
        );
        const chart = dashMock.querySelector<HTMLElement>('.dash-chart');
        if (chart) {
          gsap.to(chart, {
            y: -12,
            ease: 'none',
            scrollTrigger: { trigger: dashMock, start: 'top 80%', end: 'bottom 40%', scrub: 0.5 },
          });
        }
      }

      // 7. Partner visual
      const partnerVisual = document.querySelector<HTMLElement>('.partner-visual');
      if (partnerVisual) {
        gsap.fromTo(
          partnerVisual,
          { opacity: 0, x: 30, rotateY: -12, scale: 0.92, transformPerspective: 1400 },
          {
            opacity: 1,
            x: 0,
            rotateY: 0,
            scale: 1,
            duration: 1.0,
            ease: 'expo.out',
            scrollTrigger: { trigger: partnerVisual, start: 'top 85%', once: true },
          },
        );
        gsap.fromTo(
          partnerVisual.querySelectorAll('.pv-row'),
          { opacity: 0, x: 24, filter: 'blur(4px)' },
          {
            opacity: 1,
            x: 0,
            filter: 'blur(0px)',
            duration: 0.7,
            stagger: 0.15,
            ease: 'power2.out',
            scrollTrigger: { trigger: partnerVisual, start: 'top 80%', once: true },
          },
        );
      }

      // 8. Section titles
      document.querySelectorAll<HTMLElement>('.section-title').forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 40, rotateX: -10, z: -60, transformPerspective: 1200, filter: 'blur(6px)' },
          {
            opacity: 1,
            y: 0,
            rotateX: 0,
            z: 0,
            filter: 'blur(0px)',
            duration: 1.0,
            ease: 'expo.out',
            scrollTrigger: { trigger: el, start: 'top 88%', once: true },
          },
        );
      });

      // 9. CTA big
      const ctaBig = document.querySelector<HTMLElement>('.cta-big');
      if (ctaBig) {
        gsap.fromTo(
          ctaBig,
          {
            opacity: 0,
            scale: 0.7,
            rotateX: -25,
            z: -220,
            filter: 'blur(12px)',
            transformPerspective: 1400,
          },
          {
            opacity: 1,
            scale: 1,
            rotateX: 0,
            z: 0,
            filter: 'blur(0px)',
            duration: 1.4,
            ease: 'expo.out',
            scrollTrigger: { trigger: ctaBig, start: 'top 80%', once: true },
          },
        );
      }

      setTimeout(() => ScrollTrigger.refresh(), 400);

      cleanup = () => {
        ScrollTrigger.getAll().forEach((st) => st.kill());
        gsap.killTweensOf('*');
      };
    })();

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, [refreshKey]);

  return null;
}
