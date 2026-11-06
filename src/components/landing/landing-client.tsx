'use client';

// The landing's only client glue (LANDING-SPEC §5, §3.8): analytics events,
// sent ONLY with analytics consent (trackClient is a no-op without it), and
// the FAQ's sixth answer open by default on desktop. Clicks are read from
// data-* attributes, so the sections stay server components. Never an email,
// name or IP in an event.

import { useEffect, useRef } from 'react';
import { trackClient } from '@/lib/analytics/track-client';
import { CONSENT_CHANGED_EVENT, readConsent } from '@/lib/analytics/consent';
import type { FunnelEvent } from '@/lib/analytics/track';

type Props = Record<string, string | number | boolean>;

export function LandingClient({ signedIn }: { signedIn: boolean }) {
  const view = useRef({ sent: false, pending: false, retry: false });
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
      document
        .querySelectorAll<HTMLDetailsElement>('.pub-fq--desk-open')
        .forEach((d) => (d.open = true));

    const qs = new URLSearchParams(location.search);
    const utm: Props = {};
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      const value = qs.get(key)?.trim();
      if (value && /^[a-zA-Z0-9_. ~-]{1,80}$/.test(value)) utm[key] = value;
    }
    let ref = '';
    try {
      ref = document.referrer ? new URL(document.referrer).hostname : '';
    } catch {
      /* no referrer */
    }
    const emitView = () => {
      const state = view.current;
      if (state.sent || state.pending || !readConsent()?.analytics) return;
      state.pending = true;
      void trackClient('landing_view', { ...base(), referrer_domain: ref, ...utm })
        .then((sent) => {
          state.sent = sent;
        })
        .catch(() => {
          /* Analytics must never break the landing. */
        })
        .finally(() => {
          const retry = state.retry;
          state.retry = false;
          state.pending = false;
          if (retry && !state.sent && readConsent()?.analytics) emitView();
        });
    };
    const onConsentChange = () => {
      if (view.current.pending) view.current.retry = true;
      emitView();
    };
    window.addEventListener(CONSENT_CHANGED_EVENT, onConsentChange);
    emitView();

    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>(
        '[data-cta],[data-nav],[data-signin],[data-foot-target],summary',
      );
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
      else if (el.dataset.footTarget)
        send('landing_footer_click', { target: el.dataset.footTarget });
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
      window.removeEventListener(CONSENT_CHANGED_EVENT, onConsentChange);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('chalyb:landing', onCustom);
      io?.disconnect();
    };
  }, [signedIn]);
  return null;
}
