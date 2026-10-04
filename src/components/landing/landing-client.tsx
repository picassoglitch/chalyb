'use client';

// The landing's only client glue (LANDING-SPEC §5, §3.8): analytics events,
// sent ONLY with analytics consent (trackClient is a no-op without it), and
// the FAQ's sixth answer open by default on desktop. Clicks are read from
// data-* attributes, so the sections stay server components. Never an email,
// name or IP in an event.

import { useEffect } from 'react';
import { trackClient } from '@/lib/analytics/track-client';
import type { FunnelEvent } from '@/lib/analytics/track';

type Props = Record<string, string | number | boolean>;

export function LandingClient({ signedIn }: { signedIn: boolean }) {
  useEffect(() => {
    const base = (): Props => ({
      page: 'landing',
      locale: document.documentElement.lang,
      device: window.matchMedia('(min-width: 1024px)').matches ? 'desktop' : 'mobile',
      logged_in: signedIn,
    });
    const send = (event: string, props: Props = {}) =>
      void trackClient(event as FunnelEvent, { ...base(), ...props });

    if (window.matchMedia('(min-width: 1024px)').matches)
      document.querySelectorAll<HTMLDetailsElement>('.pub-fq--desk-open').forEach((d) => (d.open = true));

    const qs = new URLSearchParams(location.search);
    const utm: Props = {};
    qs.forEach((v, k) => {
      if (k.startsWith('utm_')) utm[k] = v.slice(0, 80);
    });
    let ref = '';
    try {
      ref = document.referrer ? new URL(document.referrer).hostname : '';
    } catch {
      /* no referrer */
    }
    send('landing_view', { referrer_domain: ref, ...utm });

    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-cta],[data-nav],[data-signin],[data-foot-target],summary');
      if (!el) return;
      if (el.dataset.cta) {
        const href = el.getAttribute('href') ?? '';
        const u = new URL(href, location.href);
        // Pricing cards carry their own data-cta; their links say `from`.
        send('landing_cta_click', {
          cta_id: u.searchParams.get('from') ?? el.dataset.cta,
          plan: u.searchParams.get('plan') ?? 'pro',
          interval: u.searchParams.get('interval') ?? '',
          section: el.closest('section')?.id || 'nav',
        });
      } else if (el.dataset.nav) send('landing_nav_click', { target: el.dataset.nav });
      else if (el.dataset.signin) send('landing_signin_click', { location: el.dataset.signin });
      else if (el.dataset.footTarget) send('landing_footer_click', { target: el.dataset.footTarget });
      else if (el.tagName === 'SUMMARY') {
        const d = el.parentElement as HTMLDetailsElement;
        if (!d.open && d.dataset.faq) send('landing_faq_open', { faq_id: Number(d.dataset.faq) });
      }
    };
    const onCustom = (e: Event) => {
      const d = (e as CustomEvent<{ event: string; props?: Props }>).detail;
      if (d?.event) send(d.event, d.props ?? {});
    };
    document.addEventListener('click', onClick, true);
    window.addEventListener('chalyb:landing', onCustom);

    const seen = new Set<string>();
    const io =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            (entries) => {
              for (const en of entries) {
                const id = (en.target as HTMLElement).dataset.section!;
                if (en.isIntersecting && !seen.has(id)) {
                  seen.add(id);
                  send('landing_section_view', { section: id });
                }
              }
            },
            { threshold: 0.5 },
          );
    const SECTIONS: Record<string, string> = {
      hero: 'hero',
      herramientas: 'herramientas',
      como: 'como',
      precios: 'precios',
      preguntas: 'preguntas',
      idea: 'idea',
      final: 'final',
    };
    for (const [id, name] of Object.entries(SECTIONS)) {
      const el = document.getElementById(id);
      if (el && io) {
        el.dataset.section = name;
        io.observe(el);
      }
    }
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('chalyb:landing', onCustom);
      io?.disconnect();
    };
  }, [signedIn]);
  return null;
}
